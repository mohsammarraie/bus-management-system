package io.github.mohsammarraie.busmanagement.fleet.persistence;

import io.github.mohsammarraie.busmanagement.fleet.domain.Bus;
import jakarta.persistence.LockModeType;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface BusRepository extends JpaRepository<Bus, Long>, JpaSpecificationExecutor<Bus> {
    // Also verify the version at commit when an update makes no actual changes.
    @Lock(LockModeType.OPTIMISTIC)
    @Query("select b from Bus b where b.id = :id")
    Optional<Bus> findForMutation(@Param("id") long id);
}
