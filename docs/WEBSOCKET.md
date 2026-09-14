# WebSocket Real-Time Updates Guide

Complete guide for using WebSocket for real-time updates in WasteFi.

## Table of Contents

- [Overview](#overview)
- [Connection](#connection)
- [Events](#events)
- [Client Examples](#client-examples)
- [Security](#security)
- [Best Practices](#best-practices)

---

## Overview

WasteFi uses WebSocket (Socket.IO) for real-time bidirectional communication between the server and clients. This enables instant notifications for:

- Collection submissions and verifications
- Payment confirmations
- KYC status updates
- Withdrawal processing
- System alerts

### Benefits

- **Instant Updates**: No polling required
- **Reduced Server Load**: Push-based instead of pull-based
- **Better UX**: Real-time feedback for users
- **Efficient**: Single persistent connection

---

## Connection

### Server Configuration

**WebSocket URL:**
```
ws://localhost:3000/socket.io/
```

**Production:**
```
wss://api.wastefi.com/socket.io/
```

### Client Connection

#### JavaScript (Socket.IO Client)

```javascript
import { io } from 'socket.io-client';

const socket = io('http://localhost:3000', {
  path: '/socket.io/',
  auth: {
    token: 'your-jwt-token-here'
  }
});

// Connection successful
socket.on('connected', (data) => {
  console.log('Connected:', data);
  // { message: 'Connected to WasteFi WebSocket', userId: '...', timestamp: '...' }
});

// Connection error
socket.on('connect_error', (error) => {
  console.error('Connection failed:', error.message);
});
```

#### React Hook

```typescript
import { useEffect, useState } from 'react';
import { io, Socket } from 'socket.io-client';

function useWebSocket(token: string) {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    if (!token) return;

    const newSocket = io('http://localhost:3000', {
      path: '/socket.io/',
      auth: { token }
    });

    newSocket.on('connected', () => {
      setConnected(true);
      console.log('WebSocket connected');
    });

    newSocket.on('disconnect', () => {
      setConnected(false);
      console.log('WebSocket disconnected');
    });

    setSocket(newSocket);

    return () => {
      newSocket.close();
    };
  }, [token]);

  return { socket, connected };
}
```

---

## Events

### Server to Client Events

#### 1. `connected`

Sent when client successfully connects.

**Payload:**
```json
{
  "message": "Connected to WasteFi WebSocket",
  "userId": "user-uuid",
  "timestamp": "2026-09-13T10:00:00Z"
}
```

---

#### 2. `notification`

General notification event for all types of updates.

**Payload:**
```json
{
  "type": "collection:verified",
  "title": "Collection Verified",
  "message": "Your collection has been verified! You earned 500 KES",
  "data": {
    "collectionId": "collection-uuid",
    "amount": 500,
    "currency": "KES"
  },
  "timestamp": "2026-09-13T10:30:00Z"
}
```

**Notification Types:**

| Type | Description |
|------|-------------|
| `collection:created` | New collection submitted |
| `collection:new` | New collection (for admins) |
| `collection:verified` | Collection verified |
| `collection:rejected` | Collection rejected |
| `payment:completed` | Payment processed |
| `payment:failed` | Payment failed |
| `withdrawal:update` | Withdrawal status changed |
| `kyc:update` | KYC status changed |
| `system:alert` | System-wide alert |

---

#### 3. `collection:created`

Sent to collector when they submit a collection.

**Payload:**
```json
{
  "type": "collection:created",
  "title": "Collection Submitted",
  "message": "Your waste collection has been submitted successfully",
  "data": {
    "collectionId": "collection-uuid",
    "materialType": "PET",
    "weight": 25.5
  },
  "timestamp": "2026-09-13T10:00:00Z"
}
```

---

#### 4. `collection:new`

Sent to admins when a new collection is submitted.

**Payload:**
```json
{
  "type": "collection:new",
  "title": "New Collection",
  "message": "New waste collection submitted by John Doe",
  "data": {
    "collectionId": "collection-uuid",
    "collectorId": "user-uuid",
    "collectorName": "John Doe",
    "materialType": "PET",
    "weight": 25.5
  },
  "timestamp": "2026-09-13T10:00:00Z"
}
```

---

#### 5. `collection:verified`

Sent to collector when their collection is verified.

**Payload:**
```json
{
  "type": "collection:verified",
  "title": "Collection Verified",
  "message": "Your collection has been verified! You earned 500 KES",
  "data": {
    "collectionId": "collection-uuid",
    "amount": 500,
    "currency": "KES",
    "verifiedBy": "admin-name"
  },
  "timestamp": "2026-09-13T10:30:00Z"
}
```

---

#### 6. `payment:completed`

Sent when payment is successfully processed.

**Payload:**
```json
{
  "type": "payment:completed",
  "title": "Payment Received",
  "message": "You received 500 KES",
  "data": {
    "transactionId": "transaction-uuid",
    "amount": 500,
    "currency": "KES",
    "paymentMethod": "STELLAR"
  },
  "timestamp": "2026-09-13T10:35:00Z"
}
```

---

#### 7. `kyc:update`

Sent when KYC status changes.

**Payload:**
```json
{
  "type": "kyc:update",
  "title": "KYC Status Update",
  "message": "Your KYC verification has been approved!",
  "data": {
    "status": "APPROVED",
    "reason": null
  },
  "timestamp": "2026-09-13T11:00:00Z"
}
```

---

#### 8. `withdrawal:update`

Sent when withdrawal status changes.

**Payload:**
```json
{
  "type": "withdrawal:update",
  "title": "Withdrawal Update",
  "message": "Your withdrawal has been completed successfully",
  "data": {
    "transactionId": "transaction-uuid",
    "status": "COMPLETED",
    "amount": 1000,
    "currency": "KES"
  },
  "timestamp": "2026-09-13T12:00:00Z"
}
```

---

### Client to Server Events

#### 1. `ping`

Health check to verify connection.

**Send:**
```javascript
socket.emit('ping');
```

**Response:**
```json
{
  "timestamp": "2026-09-13T10:00:00Z"
}
```

---

#### 2. `subscribe`

Subscribe to a specific channel.

**Send:**
```javascript
socket.emit('subscribe', 'collection:updates');
```

**Response:**
```json
{
  "channel": "collection:updates",
  "timestamp": "2026-09-13T10:00:00Z"
}
```

**Available Channels:**
- `collection:updates` - All collection-related events
- `payment:updates` - All payment-related events
- `kyc:updates` - KYC status changes
- `system:alerts` - System-wide alerts

---

#### 3. `unsubscribe`

Unsubscribe from a channel.

**Send:**
```javascript
socket.emit('unsubscribe', 'collection:updates');
```

**Response:**
```json
{
  "channel": "collection:updates",
  "timestamp": "2026-09-13T10:00:00Z"
}
```

---

## Client Examples

### React Notification Component

```typescript
import { useEffect, useState } from 'react';
import { useWebSocket } from './hooks/useWebSocket';
import { NotificationPayload } from './types';

function NotificationHandler() {
  const { socket } = useWebSocket(localStorage.getItem('token')!);
  const [notifications, setNotifications] = useState<NotificationPayload[]>([]);

  useEffect(() => {
    if (!socket) return;

    // Listen for all notifications
    socket.on('notification', (notification: NotificationPayload) => {
      setNotifications(prev => [notification, ...prev]);
      
      // Show toast/alert
      showToast(notification);
      
      // Play sound for important notifications
      if (notification.type.includes('payment') || notification.type.includes('verified')) {
        playNotificationSound();
      }
    });

    return () => {
      socket.off('notification');
    };
  }, [socket]);

  return (
    <div className="notifications">
      {notifications.map((notif, index) => (
        <NotificationCard key={index} notification={notif} />
      ))}
    </div>
  );
}
```

### Collection Tracker

```typescript
function CollectionTracker({ collectionId }: { collectionId: string }) {
  const { socket } = useWebSocket(token);
  const [status, setStatus] = useState('PENDING');

  useEffect(() => {
    if (!socket) return;

    socket.on('notification', (notification) => {
      // Check if notification is for this collection
      if (notification.data?.collectionId === collectionId) {
        if (notification.type === 'collection:verified') {
          setStatus('VERIFIED');
          // Show success message
        } else if (notification.type === 'collection:rejected') {
          setStatus('REJECTED');
          // Show error message
        }
      }
    });

    return () => {
      socket.off('notification');
    };
  }, [socket, collectionId]);

  return (
    <div>
      <p>Status: {status}</p>
    </div>
  );
}
```

### Admin Dashboard Real-Time Updates

```typescript
function AdminDashboard() {
  const { socket } = useWebSocket(token);
  const [collections, setCollections] = useState([]);

  useEffect(() => {
    if (!socket) return;

    // Listen for new collections
    socket.on('notification', (notification) => {
      if (notification.type === 'collection:new') {
        setCollections(prev => [notification.data, ...prev]);
        
        // Show desktop notification
        if (Notification.permission === 'granted') {
          new Notification('New Collection', {
            body: notification.message,
            icon: '/icon.png'
          });
        }
      }
    });

    return () => {
      socket.off('notification');
    };
  }, [socket]);

  return (
    <div>
      <h2>Recent Collections</h2>
      {collections.map(collection => (
        <CollectionCard key={collection.id} data={collection} />
      ))}
    </div>
  );
}
```

### Connection Health Monitor

```typescript
function ConnectionMonitor() {
  const { socket, connected } = useWebSocket(token);
  const [lastPing, setLastPing] = useState<Date | null>(null);

  useEffect(() => {
    if (!socket || !connected) return;

    // Ping every 30 seconds
    const interval = setInterval(() => {
      socket.emit('ping');
    }, 30000);

    socket.on('pong', (data) => {
      setLastPing(new Date(data.timestamp));
    });

    return () => {
      clearInterval(interval);
      socket.off('pong');
    };
  }, [socket, connected]);

  return (
    <div className="connection-status">
      <span className={connected ? 'online' : 'offline'}>
        {connected ? '🟢 Connected' : '🔴 Disconnected'}
      </span>
      {lastPing && <span>Last ping: {lastPing.toLocaleTimeString()}</span>}
    </div>
  );
}
```

---

## Security

### Authentication

WebSocket connections require JWT authentication:

```javascript
const socket = io('http://localhost:3000', {
  auth: {
    token: 'your-jwt-token'
  }
});
```

**Authentication fails if:**
- No token provided
- Token is invalid or expired
- Token signature doesn't match

### Authorization

Users can only:
- Receive notifications for their own actions
- Admins receive notifications for all users (role-based)
- Cannot impersonate other users
- Automatic room assignment based on userId and role

### Best Practices

1. **Use Secure Connections**
   ```javascript
   // Production - Use WSS (WebSocket Secure)
   const socket = io('https://api.wastefi.com', {
     secure: true
   });
   ```

2. **Handle Token Refresh**
   ```javascript
   socket.on('connect_error', (error) => {
     if (error.message === 'Authentication failed') {
       // Refresh token and reconnect
       refreshToken().then(newToken => {
         socket.auth.token = newToken;
         socket.connect();
       });
     }
   });
   ```

3. **Validate Notifications**
   ```javascript
   socket.on('notification', (notification) => {
     // Validate notification structure
     if (!notification.type || !notification.message) {
       console.warn('Invalid notification received');
       return;
     }
     
     // Process notification
     handleNotification(notification);
   });
   ```

4. **Clean Up Listeners**
   ```javascript
   useEffect(() => {
     socket.on('notification', handleNotification);
     
     return () => {
       socket.off('notification', handleNotification);
     };
   }, []);
   ```

---

## Best Practices

### 1. Reconnection Strategy

```javascript
const socket = io('http://localhost:3000', {
  reconnection: true,
  reconnectionAttempts: 5,
  reconnectionDelay: 1000,
  reconnectionDelayMax: 5000,
  timeout: 20000
});

socket.on('reconnect', (attemptNumber) => {
  console.log(`Reconnected after ${attemptNumber} attempts`);
});

socket.on('reconnect_failed', () => {
  console.error('Failed to reconnect after 5 attempts');
  // Show offline message to user
});
```

### 2. Error Handling

```javascript
socket.on('error', (error) => {
  console.error('Socket error:', error);
  // Log to monitoring service
  logError(error);
});

socket.on('connect_error', (error) => {
  console.error('Connection error:', error);
  // Show user-friendly message
  showError('Connection failed. Retrying...');
});
```

### 3. Offline Detection

```javascript
window.addEventListener('online', () => {
  if (!socket.connected) {
    socket.connect();
  }
});

window.addEventListener('offline', () => {
  showWarning('You are offline. Reconnecting when network is available...');
});
```

### 4. Performance

```javascript
// Throttle notifications if receiving too many
const throttledHandler = _.throttle((notification) => {
  handleNotification(notification);
}, 1000);

socket.on('notification', throttledHandler);
```

### 5. Testing

```javascript
// Mock socket for testing
const mockSocket = {
  on: jest.fn(),
  emit: jest.fn(),
  off: jest.fn(),
  connected: true
};

// Test notification handling
mockSocket.on('notification', (callback) => {
  callback({
    type: 'payment:completed',
    title: 'Payment Received',
    message: 'You received 500 KES',
    data: { amount: 500 },
    timestamp: new Date()
  });
});
```

---

## Troubleshooting

### Connection Fails

**Issue:** `connect_error: Authentication required`

**Solution:**
- Ensure JWT token is valid
- Check token is passed in auth object
- Verify token hasn't expired

### Not Receiving Notifications

**Issue:** Connected but no notifications received

**Solution:**
1. Check if listening to correct event
2. Verify user permissions
3. Check server logs
4. Test with `ping`/`pong`

### Multiple Connections

**Issue:** Same user has multiple active connections

**Solution:**
- Close previous connection before creating new one
- Use single socket instance across app
- Clean up on component unmount

---

## Production Checklist

- [ ] Use WSS (secure WebSocket) in production
- [ ] Configure proper CORS for client URL
- [ ] Implement token refresh mechanism
- [ ] Add reconnection strategy
- [ ] Set up monitoring for connection issues
- [ ] Test with poor network conditions
- [ ] Implement rate limiting for events
- [ ] Add error logging and alerts

---

**Last Updated:** 2026-09-13  
**Version:** 1.0.0
