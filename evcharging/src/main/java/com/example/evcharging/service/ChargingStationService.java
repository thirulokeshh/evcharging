package com.example.evcharging.service;

import com.example.evcharging.dto.ChargingStationDTO;
import com.example.evcharging.model.ChargingStation;
import com.example.evcharging.repository.ChargingStationRepository;
import org.springframework.stereotype.Service;

import java.util.List;

@Service
public class ChargingStationService {

    private final ChargingStationRepository repository;

    public ChargingStationService(ChargingStationRepository repository) {
        this.repository = repository;
    }

    public ChargingStationDTO createStation(ChargingStationDTO dto) {
        ChargingStation station = toEntity(dto);
        ChargingStation saved = repository.save(station);
        return toDTO(saved);
    }

    public List<ChargingStationDTO> getAllStations() {
        return repository.findAll()
                .stream()
                .map(this::toDTO)
                .toList();
    }

    public ChargingStationDTO getStationById(Long id) {
        return repository.findById(id)
                .map(this::toDTO)
                .orElse(null);
    }

    private ChargingStation toEntity(ChargingStationDTO dto) {
        ChargingStation station = new ChargingStation();
        station.setArea(dto.getArea());
        station.setLatitude(dto.getLatitude());
        station.setLongitude(dto.getLongitude());
        return station;
    }

    private ChargingStationDTO toDTO(ChargingStation station) {
        return new ChargingStationDTO(
                station.getId(),
                station.getArea(),
                station.getLatitude(),
                station.getLongitude()
        );
    }
}
