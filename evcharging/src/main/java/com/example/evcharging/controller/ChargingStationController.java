package com.example.evcharging.controller;

import com.example.evcharging.dto.ChargingStationDTO;
import com.example.evcharging.model.StationStatus;
import com.example.evcharging.service.ChargingStationService;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/stations")
public class ChargingStationController {

    private final ChargingStationService service;

    public ChargingStationController(ChargingStationService service) {
        this.service = service;
    }

    @PostMapping
    public ChargingStationDTO addStation(@RequestBody ChargingStationDTO dto) {
        return service.createStation(dto);
    }

    @GetMapping
    public List<ChargingStationDTO> getAllStations() {
        return service.getAllStations();
    }

    @GetMapping("/{id}")
    public ChargingStationDTO getStationById(@PathVariable Long id) {

        return service.getStationById(id);
    }
    @GetMapping("/ping")
    public String ping() {
        return "pong";
    }
    @PutMapping("/{id}/status")
    public ChargingStationDTO updateStatus(
            @PathVariable Long id,
            @RequestBody StationStatus status
    )
    {
        return service.updateStatus(id, status);
    }


}
