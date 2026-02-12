package com.example.evcharging.dto;

import com.example.evcharging.model.StationStatus;

public class ChargingStationDTO {

    private Long id;
    private String area;
    private double latitude;
    private double longitude;
    private StationStatus status;
    public ChargingStationDTO() {
    }

    public ChargingStationDTO(Long id, String area, double latitude, double longitude,StationStatus status) {
        this.id = id;
        this.area = area;
        this.latitude = latitude;
        this.longitude = longitude;
    }

    public Long getId() {
        return id;
    }

    public void setId(Long id) {
        this.id = id;
    }

    public String getArea() {
        return area;
    }

    public void setArea(String area) {
        this.area = area;
    }

    public double getLatitude() {
        return latitude;
    }

    public void setLatitude(double latitude) {
        this.latitude = latitude;
    }

    public double getLongitude() {
        return longitude;
    }

    public void setLongitude(double longitude) {
        this.longitude = longitude;
    }
    public void setStatus(StationStatus status){
        this.status=status;
    }
    public StationStatus getStatus(){
        return status;
    }
}
