# Collection Points & Geolocation Guide

## Overview

Collection points are physical locations where waste collectors can bring recyclable materials. The system includes comprehensive geolocation features for finding nearby collection points.

## Features

✅ **CRUD Operations** - Create, Read, Update, Delete collection points
✅ **Geolocation Search** - Find nearby collection points by coordinates
✅ **Distance Calculation** - Haversine formula for accurate distances
✅ **Filtering** - Filter by city, country, radius
✅ **Verification** - Admin verification workflow
✅ **Operating Hours** - Flexible schedule management
✅ **Material Types** - Track accepted materials per location

## API Endpoints

### List Collection Points

```bash
GET /api/v1/collection-points?city=Nairobi&limit=20
```

Query Parameters:
- `city` - Filter by city name (partial match)
- `country` - Filter by country (default: Kenya)
- `latitude` - User's latitude (for distance filtering)
- `longitude` - User's longitude (for distance filtering)
- `radius` - Search radius in kilometers (default: 10km)
- `limit` - Maximum results (default: 50, max: 100)

Response:
```json
{
  "success": true,
  "data": [
    {
      "id": "cp-123",
      "name": "Nairobi Central Collection Point",
      "description": "Main collection point in downtown Nairobi",
      "latitude": -1.2864,
      "longitude": 36.8172,
      "address": "Tom Mboya Street, Nairobi",
      "city": "Nairobi",
      "country": "Kenya",
      "contactPerson": "John Doe",
      "contactPhone": "+254700000001",
      "contactEmail": "nairobi@wastefi.com",
      "isActive": true,
      "verifiedAt": "2024-01-15T10:30:00Z",
      "operatingHours": {
        "monday": "08:00-18:00",
        "tuesday": "08:00-18:00",
        "wednesday": "08:00-18:00",
        "thursday": "08:00-18:00",
        "friday": "08:00-18:00",
        "saturday": "08:00-14:00",
        "sunday": "closed"
      },
      "acceptedMaterials": ["PET", "HDPE", "Glass", "Aluminum", "Steel"],
      "createdAt": "2024-01-01T00:00:00Z",
      "updatedAt": "2024-01-15T10:30:00Z"
    }
  ],
  "count": 1
}
```

### Find Nearby Collection Points

```bash
GET /api/v1/collection-points/nearby?latitude=-1.2921&longitude=36.8219&radius=5&limit=10
```

Query Parameters (Required):
- `latitude` - Your latitude (-90 to 90)
- `longitude` - Your longitude (-180 to 180)
- `radius` - Search radius in km (default: 10, max: 100)
- `limit` - Max results (default: 10, max: 50)

Response:
```json
{
  "success": true,
  "data": [
    {
      "id": "cp-123",
      "name": "Nairobi Central Collection Point",
      "latitude": -1.2864,
      "longitude": 36.8172,
      "address": "Tom Mboya Street, Nairobi",
      "city": "Nairobi",
      "distance": 0.65,
      "isActive": true,
      "operatingHours": {...},
      "acceptedMaterials": ["PET", "HDPE", "Glass"]
    },
    {
      "id": "cp-124",
      "name": "Westlands Recycling Center",
      "distance": 3.2,
      ...
    }
  ],
  "count": 2
}
```

**Note:** Results are sorted by distance (nearest first) and include `distance` field in kilometers.

### Get Collection Point by ID

```bash
GET /api/v1/collection-points/cp-123
```

Response includes collection statistics:
```json
{
  "success": true,
  "data": {
    "id": "cp-123",
    "name": "Nairobi Central Collection Point",
    ...
    "_count": {
      "collections": 1250
    }
  }
}
```

### Create Collection Point (Admin Only)

```bash
POST /api/v1/collection-points
Authorization: Bearer <admin-token>
Content-Type: application/json

{
  "name": "Nairobi Central Collection Point",
  "description": "Main collection point in downtown",
  "latitude": -1.2864,
  "longitude": 36.8172,
  "address": "Tom Mboya Street, Nairobi",
  "city": "Nairobi",
  "country": "Kenya",
  "contactPerson": "John Doe",
  "contactPhone": "+254700000001",
  "contactEmail": "nairobi@wastefi.com",
  "operatingHours": {
    "monday": "08:00-18:00",
    "tuesday": "08:00-18:00",
    "wednesday": "08:00-18:00",
    "thursday": "08:00-18:00",
    "friday": "08:00-18:00",
    "saturday": "08:00-14:00",
    "sunday": "closed"
  },
  "acceptedMaterials": ["PET", "HDPE", "Glass", "Aluminum"]
}
```

### Update Collection Point (Admin Only)

```bash
PUT /api/v1/collection-points/cp-123
Authorization: Bearer <admin-token>
Content-Type: application/json

{
  "contactPhone": "+254700000002",
  "operatingHours": {
    "monday": "07:00-19:00",
    ...
  },
  "isActive": true
}
```

### Delete Collection Point (Admin Only)

```bash
DELETE /api/v1/collection-points/cp-123
Authorization: Bearer <admin-token>
```

**Note:** This is a soft delete. The collection point is marked as inactive but data is retained.

### Verify Collection Point (Admin Only)

```bash
POST /api/v1/collection-points/cp-123/verify
Authorization: Bearer <admin-token>
```

## Geolocation Features

### Distance Calculation

The system uses the **Haversine formula** for calculating great-circle distances between coordinates:

```typescript
// Calculate distance between two points
const distance = GeolocationUtil.calculateDistance(
  lat1, lon1,  // User location
  lat2, lon2   // Collection point
);
// Returns distance in kilometers (e.g., 2.45)
```

### Coordinate Validation

```typescript
// Validate coordinates before saving
const isValid = GeolocationUtil.isValidCoordinate(latitude, longitude);
// Latitude: -90 to 90
// Longitude: -180 to 180
```

### Bounding Box

Get bounding box for efficient database queries:

```typescript
const bbox = GeolocationUtil.getBoundingBox(
  latitude,
  longitude,
  radiusKm
);
// Returns: { minLat, maxLat, minLon, maxLon }
```

### Bearing & Direction

```typescript
// Get compass bearing between two points
const bearing = GeolocationUtil.getBearing(lat1, lon1, lat2, lon2);
// Returns: 0-360 degrees

// Get cardinal direction
const direction = GeolocationUtil.getCardinalDirection(bearing);
// Returns: "N", "NE", "E", "SE", "S", "SW", "W", "NW"
```

## Mobile App Integration

### Find Nearest Collection Point

```javascript
// 1. Get user's location
navigator.geolocation.getCurrentPosition(async (position) => {
  const { latitude, longitude } = position.coords;

  // 2. Find nearby collection points
  const response = await fetch(
    `/api/v1/collection-points/nearby?` +
    `latitude=${latitude}&longitude=${longitude}&` +
    `radius=5&limit=5`
  );

  const { data } = await response.json();

  // 3. Display on map or list
  data.forEach(point => {
    console.log(`${point.name} - ${point.distance}km away`);
  });
});
```

### Display on Map

```javascript
// Using Mapbox, Google Maps, or Leaflet
import { Map, Marker } from 'mapbox-gl';

const map = new Map({
  container: 'map',
  center: [longitude, latitude],
  zoom: 12
});

// Add user location marker
new Marker({ color: 'blue' })
  .setLngLat([longitude, latitude])
  .addTo(map);

// Add collection point markers
collectionPoints.forEach(point => {
  new Marker({ color: 'green' })
    .setLngLat([point.longitude, point.latitude])
    .setPopup(new Popup().setHTML(
      `<h3>${point.name}</h3>
       <p>${point.distance}km away</p>
       <p>${point.address}</p>`
    ))
    .addTo(map);
});
```

### Get Directions

```javascript
// Generate Google Maps directions URL
const getDirectionsUrl = (point) => {
  return `https://www.google.com/maps/dir/?api=1&` +
    `destination=${point.latitude},${point.longitude}&` +
    `travelmode=driving`;
};

// Open in browser or maps app
window.open(getDirectionsUrl(collectionPoint));
```

## Operating Hours

### Format

```json
{
  "monday": "08:00-18:00",
  "tuesday": "08:00-18:00",
  "wednesday": "08:00-18:00",
  "thursday": "08:00-18:00",
  "friday": "08:00-18:00",
  "saturday": "08:00-14:00",
  "sunday": "closed"
}
```

### Check if Open Now

```javascript
const isOpenNow = (operatingHours) => {
  const now = new Date();
  const day = now.toLocaleDateString('en-US', { weekday: 'lowercase' });
  const time = now.toTimeString().slice(0, 5); // "HH:MM"

  const hours = operatingHours[day];
  if (!hours || hours === 'closed') return false;

  const [open, close] = hours.split('-');
  return time >= open && time <= close;
};
```

## Accepted Materials

### Common Material Types

- **PET** - Polyethylene Terephthalate (water bottles, soft drink bottles)
- **HDPE** - High-Density Polyethylene (milk jugs, detergent bottles)
- **PVC** - Polyvinyl Chloride (pipes, vinyl)
- **LDPE** - Low-Density Polyethylene (plastic bags)
- **PP** - Polypropylene (yogurt containers, bottle caps)
- **PS** - Polystyrene (foam cups, takeout containers)
- **Glass** - Glass bottles and jars
- **Aluminum** - Aluminum cans
- **Steel** - Steel cans
- **Cardboard** - Corrugated cardboard
- **Paper** - Office paper, newspapers

### Filter by Material

```javascript
// Find collection points accepting specific materials
const findByMaterial = (materialType) => {
  return collectionPoints.filter(point =>
    point.acceptedMaterials.includes(materialType)
  );
};

const petPoints = findByMaterial('PET');
```

## Best Practices

### For Admins

✅ **Verify Locations** - Confirm coordinates are accurate
✅ **Update Hours** - Keep operating hours current
✅ **Add Photos** - Include facility photos (future feature)
✅ **Contact Info** - Ensure phone numbers are active
✅ **Verify Regularly** - Re-verify collection points periodically

### For Developers

✅ **Cache Results** - Cache nearby searches for performance
✅ **Batch Updates** - Batch geocoding API calls
✅ **Error Handling** - Handle location permission denials
✅ **Offline Support** - Cache collection points for offline use
✅ **Accuracy** - Use high-accuracy GPS when available

### For Users

✅ **Enable Location** - Allow location access for best results
✅ **Check Hours** - Verify opening hours before visiting
✅ **Call Ahead** - Contact for large deliveries
✅ **Sort Materials** - Pre-sort materials if requested

## Performance Optimization

### Caching Strategy

```javascript
// Cache nearby collection points for 5 minutes
const CACHE_DURATION = 5 * 60 * 1000;
let cachedPoints = null;
let cacheTime = 0;

const getNearbyWithCache = async (lat, lon, radius) => {
  const now = Date.now();
  if (cachedPoints && (now - cacheTime) < CACHE_DURATION) {
    return cachedPoints;
  }

  const points = await fetchNearby(lat, lon, radius);
  cachedPoints = points;
  cacheTime = now;
  return points;
};
```

### Database Indexing

The schema includes indexes on:
- `latitude, longitude` - For geospatial queries
- `isActive` - For filtering active points
- `city` - For city-based filtering

## Troubleshooting

### No Results Found

**Check:**
- Location permissions enabled
- Radius large enough (try 20km)
- Collection points exist in area
- Points are marked as active

### Incorrect Distances

**Check:**
- Coordinates are in correct format (decimal degrees)
- Latitude/longitude not swapped
- Using correct units (kilometers vs miles)

### Slow Queries

**Optimize:**
- Reduce search radius
- Limit number of results
- Use city filter first
- Cache results

## Future Enhancements

- [ ] Real-time capacity tracking
- [ ] Queue management
- [ ] Photo uploads for collection points
- [ ] Reviews and ratings
- [ ] Opening hours exceptions (holidays)
- [ ] Estimated wait times
- [ ] Material-specific pricing
- [ ] Integration with navigation apps
- [ ] Push notifications for nearby points
- [ ] Collection point analytics dashboard

## API Testing Examples

### cURL Examples

```bash
# Find nearby
curl "http://localhost:3000/api/v1/collection-points/nearby?\
latitude=-1.2921&longitude=36.8219&radius=10"

# List by city
curl "http://localhost:3000/api/v1/collection-points?\
city=Nairobi&limit=10"

# Get specific point
curl "http://localhost:3000/api/v1/collection-points/cp-123"

# Create (admin)
curl -X POST http://localhost:3000/api/v1/collection-points \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Test Point",
    "latitude": -1.2864,
    "longitude": 36.8172,
    "address": "123 Test St",
    "city": "Nairobi",
    "contactPerson": "John Doe",
    "contactPhone": "+254700000001"
  }'
```

## Support

For collection point issues:
- Check API documentation
- Verify coordinates format
- Test with known locations
- Contact support if problems persist
