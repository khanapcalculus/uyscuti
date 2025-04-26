const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');
const path = require('path');

const app = express();
app.use(cors());

// Serve static files from the React build directory
app.use(express.static(path.join(__dirname, 'build')));

const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: process.env.CORS_ORIGIN || "https://uyscuti.onrender.com",
    methods: ["GET", "POST"],
    credentials: true
  }
});

// Store connected users
const users = {};
// Store whiteboard pages
const pages = [{ lines: [], shapes: [] }];

io.on('connection', (socket) => {
  console.log('New client connected');
  
  // Assign a unique ID to the user
  const userId = socket.id;
  users[userId] = { id: userId };
  
  // Send current state to new user
  socket.emit('initialState', { pages });
  
  // Broadcast to all clients that a new user has joined
  io.emit('userJoined', { userId });
  
  // Listen for drawing events
  socket.on('draw', (data) => {
    // Update server state
    if (!pages[data.page]) {
      pages[data.page] = { lines: [], shapes: [] };
    }
    pages[data.page].lines.push(data.line);
    
    // Broadcast the drawing data to all other clients
    socket.broadcast.emit('draw', { ...data, userId });
  });
  
  // Listen for shape events
  socket.on('shape', (data) => {
    // Update server state
    if (!pages[data.page]) {
      pages[data.page] = { lines: [], shapes: [] };
    }
    
    // If the shape is an image, ensure it's 300px wide with preserved aspect ratio
    if (data.shape && data.shape.type === 'image') {
      const aspectRatio = data.shape.height / data.shape.width;
      data.shape.width = 300;
      data.shape.height = 300 * aspectRatio;
      
      // Make sure we're sending the imageUrl to other clients
      if (data.shape.imageUrl) {
        // The shape is good to go
      } else if (data.shape.image) {
        // If we have image data but no URL, create a URL
        data.shape.imageUrl = data.shape.image;
        delete data.shape.image; // Remove the image object as it can't be serialized
      }
    }
    
    pages[data.page].shapes.push(data.shape);
    
    // Broadcast the shape data to all other clients
    socket.broadcast.emit('shape', { ...data, userId });
  });
  
  // Listen for shape update events
  socket.on('shapeUpdate', (data) => {
    // Update server state
    if (pages[data.page]) {
      const shapeIndex = pages[data.page].shapes.findIndex(s => s.id === data.shape.id);
      if (shapeIndex !== -1) {
        // Merge the existing shape with the updated properties
        pages[data.page].shapes[shapeIndex] = {
          ...pages[data.page].shapes[shapeIndex],
          ...data.shape
        };
      }
    }
    
    // Broadcast the shape update to all other clients
    socket.broadcast.emit('shapeUpdate', { 
      shape: data.shape,
      page: data.page,
      userId
    });
  });
  
  // Listen for clear canvas event
  socket.on('clearCanvas', (data) => {
    // Update server state
    if (pages[data.page]) {
      pages[data.page] = { lines: [], shapes: [] };
    }
    
    socket.broadcast.emit('clearCanvas', { ...data });
  });
  
  // Listen for page change event
  socket.on('changePage', (data) => {
    // Broadcast to all clients that a user changed page
    socket.broadcast.emit('pageChanged', { 
      page: data.page,
      userId
    });
  });
  
  // Listen for add page event
  socket.on('addPage', () => {
    // Add a new page to the server state
    pages.push({ lines: [], shapes: [] });
    
    // Broadcast to all clients that a new page has been added
    io.emit('pageAdded', { totalPages: pages.length });
  });
  
  // Handle disconnection
  socket.on('disconnect', () => {
    console.log('Client disconnected');
    delete users[userId];
    io.emit('userLeft', { userId });
  });
});

// Add this route to serve the React app
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'build', 'index.html'));
});

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});