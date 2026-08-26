package com.example.evcharging.repository;

import com.example.evcharging.model.ChargingStation;
import org.springframework.data.jpa.repository.JpaRepository;

public interface ChargingStationRepository
        extends JpaRepository<ChargingStation, Long> {
}
