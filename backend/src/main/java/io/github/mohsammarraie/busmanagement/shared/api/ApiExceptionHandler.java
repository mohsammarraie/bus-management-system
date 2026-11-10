package io.github.mohsammarraie.busmanagement.shared.api;

import io.github.mohsammarraie.busmanagement.fleet.application.BusException;
import java.sql.SQLException;
import java.util.List;
import java.util.Map;
import java.util.TreeMap;
import java.util.stream.Collectors;
import org.hibernate.exception.ConstraintViolationException;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.dao.OptimisticLockingFailureException;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.HttpStatusCode;
import org.springframework.http.ProblemDetail;
import org.springframework.http.ResponseEntity;
import org.springframework.validation.FieldError;
import org.springframework.validation.method.ParameterErrors;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.context.request.WebRequest;
import org.springframework.web.servlet.mvc.method.annotation.ResponseEntityExceptionHandler;
import org.springframework.web.method.annotation.HandlerMethodValidationException;

@RestControllerAdvice
public class ApiExceptionHandler extends ResponseEntityExceptionHandler {
    @ExceptionHandler(BusException.class)
    ProblemDetail bus(BusException exception) {
        return switch (exception.reason()) {
            case NOT_FOUND -> problem(HttpStatus.NOT_FOUND, "BUS_NOT_FOUND", "The bus does not exist.");
            case STALE_VERSION -> staleVersion();
        };
    }

    @ExceptionHandler(OptimisticLockingFailureException.class)
    ProblemDetail concurrentEdit(OptimisticLockingFailureException exception) {
        return staleVersion();
    }

    @ExceptionHandler(DataIntegrityViolationException.class)
    ProblemDetail constraint(DataIntegrityViolationException exception) {
        for (Throwable cause = exception; cause != null; cause = cause.getCause()) {
            if (cause instanceof ConstraintViolationException violation
                    && "uq_buses_registration_number".equals(violation.getConstraintName())) {
                return problem(HttpStatus.CONFLICT, "BUS_REGISTRATION_CONFLICT",
                        "A bus with that registration number already exists.");
            }
            if (cause instanceof SQLException sql && "23503".equals(sql.getSQLState())) {
                return problem(HttpStatus.CONFLICT, "BUS_IN_USE", "The bus is referenced by another record.");
            }
        }
        // Do not expose SQL, constraint details, rejected values or database credentials.
        return problem(HttpStatus.INTERNAL_SERVER_ERROR, "INTERNAL_ERROR", "The request could not be completed.");
    }

    @Override
    protected ResponseEntity<Object> handleMethodArgumentNotValid(MethodArgumentNotValidException exception,
            HttpHeaders headers, HttpStatusCode status, WebRequest request) {
        return handleExceptionInternal(exception, validationProblem(exception.getBindingResult().getFieldErrors()),
                headers, status, request);
    }

    @Override
    protected ResponseEntity<Object> handleHandlerMethodValidationException(HandlerMethodValidationException exception,
            HttpHeaders headers, HttpStatusCode status, WebRequest request) {
        List<FieldError> fields = exception.getParameterValidationResults().stream()
                .filter(ParameterErrors.class::isInstance).map(ParameterErrors.class::cast)
                .flatMap(errors -> errors.getFieldErrors().stream()).toList();
        if (fields.isEmpty()) return super.handleHandlerMethodValidationException(exception, headers, status, request);
        return handleExceptionInternal(exception, validationProblem(fields), headers, status, request);
    }

    private ProblemDetail validationProblem(List<FieldError> errors) {
        ProblemDetail body = problem(HttpStatus.BAD_REQUEST, "VALIDATION_FAILED", "One or more fields are invalid.");
        Map<String, List<String>> fields = errors.stream()
                .collect(Collectors.groupingBy(error -> error.getField(), TreeMap::new,
                        Collectors.mapping(error -> error.getDefaultMessage() == null ? "INVALID" : error.getDefaultMessage(),
                                Collectors.collectingAndThen(Collectors.toList(), codes -> codes.stream().distinct().sorted().toList()))));
        body.setProperty("fields", fields);
        return body;
    }

    @Override
    protected ResponseEntity<Object> createResponseEntity(Object body, HttpHeaders headers,
            HttpStatusCode status, WebRequest request) {
        if (body instanceof ProblemDetail detail && (detail.getProperties() == null
                || !detail.getProperties().containsKey("code"))) {
            detail.setProperty("code", switch (status.value()) {
                case 400 -> "INVALID_REQUEST";
                case 404 -> "RESOURCE_NOT_FOUND";
                case 405 -> "METHOD_NOT_ALLOWED";
                case 406 -> "NOT_ACCEPTABLE";
                case 415 -> "UNSUPPORTED_MEDIA_TYPE";
                case 500 -> "INTERNAL_ERROR";
                default -> "REQUEST_FAILED";
            });
            detail.setDetail("The request could not be processed.");
        }
        return super.createResponseEntity(body, headers, status, request);
    }

    private ProblemDetail staleVersion() {
        return problem(HttpStatus.CONFLICT, "BUS_VERSION_CONFLICT", "The bus has changed. Reload it before trying again.");
    }

    private ProblemDetail problem(HttpStatus status, String code, String detail) {
        ProblemDetail body = ProblemDetail.forStatusAndDetail(status, detail);
        body.setProperty("code", code);
        return body;
    }
}
