package com.example.evcharging.service;

import com.example.evcharging.dto.ChargingStationDTO;
import com.example.evcharging.model.ChargingStation;
import com.example.evcharging.model.StationStatus;
import com.example.evcharging.repository.ChargingStationRepository;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Service;

import java.util.List;

@Service
public class ChargingStationService {

    private final ChargingStationRepository repository;
    private final SimpMessagingTemplate messagingTemplate;

    public ChargingStationService(
            ChargingStationRepository repository,
            SimpMessagingTemplate messagingTemplate
    ) {
        this.repository = repository;
        this.messagingTemplate = messagingTemplate;
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

    public ChargingStationDTO updateStatus(Long id, StationStatus status) {

        ChargingStation station = repository.findById(id)
                .orElseThrow(() -> new RuntimeException("Station not found"));

        station.setStatus(status);
        ChargingStation saved = repository.save(station);

        ChargingStationDTO dto = toDTO(saved);

        // WebSocket event broadcast
        messagingTemplate.convertAndSend(
                "/topic/station-status",
                dto
        );

        return dto;
    }

    private ChargingStation toEntity(ChargingStationDTO dto) {
        ChargingStation station = new ChargingStation();
        station.setArea(dto.getArea());
        station.setLatitude(dto.getLatitude());
        station.setLongitude(dto.getLongitude());
        station.setStatus(
                dto.getStatus() != null ? dto.getStatus() : StationStatus.AVAILABLE
        );
        return station;
    }

    private ChargingStationDTO toDTO(ChargingStation station) {
        return new ChargingStationDTO(
                station.getId(),
                station.getArea(),
                station.getLatitude(),
                station.getLongitude(),
                station.getStatus()
        );
    }
}
