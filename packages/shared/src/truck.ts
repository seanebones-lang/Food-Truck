// Truck location types and schemas
import { z } from 'zod';

export interface Coordinate {
  latitude: number;
  longitude: number;
}

export const locationSchema = z.object({
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
});

export const truckLocationSchema = z.object({
  truckId: z.string(),
  location: locationSchema,
  heading: z.number().min(0).max(360).optional(),
  speed: z.number().nonnegative().optional(),
});

export interface Truck {
  id: string;
  name: string;
  driverName?: string;
  location: Coordinate;
  heading?: number;
  speed?: number;
  isActive: boolean;
  schedule?: TruckSchedule;
  estimatedWaitTime?: number; // in minutes
  lastUpdated: string;
}

export interface TruckSchedule {
  startTime: string; // ISO time string
  endTime: string; // ISO time string
  location: Coordinate;
  address?: string;
}

export interface NearbyTrucksQuery {
  latitude: number;
  longitude: number;
  radius?: number; // in kilometers, default 5km
  limit?: number; // default 20
}

export interface TruckRoute {
  truckId: string;
  waypoints: Coordinate[];
  currentWaypointIndex: number;
  estimatedArrival?: string;
}

export type TruckLocationUpdate = z.infer<typeof truckLocationSchema>;
