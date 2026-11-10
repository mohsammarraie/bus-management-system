package io.github.mohsammarraie.busmanagement.fleet.application;

import io.github.mohsammarraie.busmanagement.fleet.api.BusPage;
import io.github.mohsammarraie.busmanagement.fleet.api.BusResponse;
import io.github.mohsammarraie.busmanagement.fleet.domain.Bus;
import io.github.mohsammarraie.busmanagement.fleet.persistence.BusRepository;
import java.util.Locale;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@Transactional(readOnly = true)
@PreAuthorize("hasRole('ADMIN')")
public class BusService {
    private final BusRepository buses;

    public BusService(BusRepository buses) {
        this.buses = buses;
    }

    public BusPage list(int page, int size, String sort, String direction, String query, Boolean active) {
        Sort order = Sort.by(Sort.Direction.fromString(direction), sort);
        if (!sort.equals("id")) order = order.and(Sort.by("id"));
        Specification<Bus> filter = (root, criteria, cb) -> cb.conjunction();
        if (active != null) filter = filter.and((root, criteria, cb) -> cb.equal(root.get("active"), active));
        if (query != null && !query.isBlank()) {
            String pattern = "%" + query.strip().toLowerCase(Locale.ROOT)
                    .replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_") + "%";
            filter = filter.and((root, criteria, cb) -> cb.like(cb.lower(root.get("registrationNumber")), pattern, '\\'));
        }
        return BusPage.from(buses.findAll(filter, PageRequest.of(page, size, order)).map(BusResponse::from));
    }

    public BusResponse get(long id) {
        return BusResponse.from(buses.findById(id).orElseThrow(() -> new BusException(BusException.Reason.NOT_FOUND)));
    }

    @Transactional
    public BusResponse create(String registrationNumber, int capacity, boolean active) {
        Bus bus = new Bus(registrationNumber, capacity, active);
        return BusResponse.from(buses.saveAndFlush(bus));
    }

    @Transactional
    public BusResponse update(long id, String registrationNumber, int capacity, boolean active, long version) {
        Bus bus = forMutation(id, version);
        bus.changeDetails(registrationNumber, capacity, active);
        buses.flush();
        return BusResponse.from(bus);
    }

    @Transactional
    public void delete(long id, long version) {
        Bus bus = forMutation(id, version);
        buses.delete(bus);
        buses.flush();
    }
    private Bus forMutation(long id, long version) {

        Bus bus = buses.findForMutation(id).orElseThrow(() -> new BusException(BusException.Reason.NOT_FOUND));
        if (bus.getVersion() != version) throw new BusException(BusException.Reason.STALE_VERSION);
        return bus;
    }
}
