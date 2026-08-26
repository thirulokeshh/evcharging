package com.example.evcharging.model;

import jakarta.persistence.*;

@Entity
@Table(name = "charging_station")
public class ChargingStation {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    private String area;
    private double latitude;
    private double longitude;

    // how this enums works internally//

    @Enumerated(EnumType.STRING)
    private StationStatus status =StationStatus.AVAILABLE;

    public StationStatus getStatus() {
        return status;
    }

    public void setStatus(StationStatus status) {
        this.status = status;
    }

    public ChargingStation() {
    }

    public Long getId() {
        return id;
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
}
