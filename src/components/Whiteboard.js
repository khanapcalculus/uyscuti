import React, { useState, useRef, useEffect } from 'react';
import { Stage, Layer, Line, Rect, Circle, Transformer, Image } from 'react-konva';
import io from 'socket.io-client';
import './Whiteboard.css'; // We'll create this file for styling

// Import your PNG icons
import penIcon from '../assets/icons/pen.png';
import eraserIcon from '../assets/icons/eraser.png';
import rectIcon from '../assets/icons/rectangle.png';
import circleIcon from '../assets/icons/circle.png';
import selectIcon from '../assets/icons/select.png';
import clearIcon from '../assets/icons/clear.png';
import imageIcon from '../assets/icons/image.png';
import prevIcon from '../assets/icons/prev.png';
import nextIcon from '../assets/icons/next.png';
import logoImage from '../assets/icons/logo.png';

const Whiteboard = () => {
  const [tool, setTool] = useState('pen');
  const [lines, setLines] = useState([]);
  const [shapes, setShapes] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [currentPage, setCurrentPage] = useState(0);
  // Initialize with 12 empty pages
  const [pages, setPages] = useState(Array(12).fill().map(() => ({ lines: [], shapes: [] })));
  const [isDrawing, setIsDrawing] = useState(false);
  const [stageSize, setStageSize] = useState({
    width: window.innerWidth,
    // Double the height to make the canvas taller
    height: window.innerHeight * 2
  });
  const [currentColor, setCurrentColor] = useState('#000000');
  const [currentStrokeWidth, setCurrentStrokeWidth] = useState(5);
  const [showColorPalette, setShowColorPalette] = useState(false);
  const [showStrokePalette, setShowStrokePalette] = useState(false);
  // Add state for canvas position for scrolling
  const [stagePosition, setStagePosition] = useState({ x: 0, y: 0 });
  
  const stageRef = useRef(null);
  const socketRef = useRef(null);
  const transformerRef = useRef(null);
  const containerRef = useRef(null);
  
  // Color palette options
  const colors = [
    '#000000', '#FF0000', '#00FF00', '#0000FF',
    '#FFFF00', '#FF00FF', '#00FFFF', '#FFFFFF',
    '#FFA500', '#800080', '#008000', '#800000',
    '#808080', '#FFC0CB', '#A52A2A', '#FFD700'
  ];
  
  // Stroke width options
  const strokeWidths = [1, 3, 5, 8, 10, 15, 20, 25];
  
  useEffect(() => {
    // Connect to the socket server
    const serverUrl = process.env.REACT_APP_SERVER_URL || 'http://localhost:5000';
    socketRef.current = io(serverUrl, {
      transports: ['websocket'],
      secure: true
    });
    
    // Listen for drawing events from other users
    socketRef.current.on('draw', (data) => {
      setPages(prevPages => {
        const newPages = [...prevPages];
        if (data.page >= 0 && data.page < newPages.length) {
          newPages[data.page].lines = [...newPages[data.page].lines, data.line];
        }
        return newPages;
      });
    });
    
    // Listen for shape events
    socketRef.current.on('shape', (data) => {
      setPages(prevPages => {
        const newPages = [...prevPages];
        if (data.page >= 0 && data.page < newPages.length) {
          newPages[data.page].shapes = [...newPages[data.page].shapes, data.shape];
        }
        return newPages;
      });
    });
    
    // Listen for shape update events
    socketRef.current.on('shapeUpdate', (data) => {
      setPages(prevPages => {
        const newPages = [...prevPages];
        if (data.page >= 0 && data.page < newPages.length) {
          const shapeIndex = newPages[data.page].shapes.findIndex(s => s.id === data.shape.id);
          
          if (shapeIndex !== -1) {
            // Update the shape with the new properties
            newPages[data.page].shapes[shapeIndex] = {
              ...newPages[data.page].shapes[shapeIndex],
              ...data.shape
            };
          }
        }
        return newPages;
      });
    });
    
    // Listen for clear canvas event
    socketRef.current.on('clearCanvas', (data) => {
      setPages(prevPages => {
        const newPages = [...prevPages];
        if (data.page >= 0 && data.page < newPages.length) {
          newPages[data.page] = { lines: [], shapes: [] };
        }
        return newPages;
      });
    });
    
    // Listen for page changed event
    socketRef.current.on('pageChanged', (data) => {
      // Update current page when another user changes pages
      if (data.page >= 0 && data.page < 12) {
        setCurrentPage(data.page);
      }
    });
    
    // Listen for initial state
    socketRef.current.on('initialState', (data) => {
      if (data.pages && data.pages.length > 0) {
        // Ensure we maintain 12 pages
        const newPages = Array(12).fill().map((_, i) => {
          return data.pages[i] || { lines: [], shapes: [] };
        });
        setPages(newPages);
      }
    });
    
    // Handle window resize
    const handleResize = () => {
      setStageSize({
        width: window.innerWidth,
        // Maintain double height on resize
        height: window.innerHeight * 2
      });
    };
    
    window.addEventListener('resize', handleResize);
    
    return () => {
      socketRef.current.disconnect();
      window.removeEventListener('resize', handleResize);
    };
  }, []);
  
  useEffect(() => {
    if (selectedId && transformerRef.current) {
      // Find the selected node
      const selectedNode = stageRef.current.findOne('#' + selectedId);
      if (selectedNode) {
        // Attach transformer to the selected node
        transformerRef.current.nodes([selectedNode]);
        transformerRef.current.getLayer().batchDraw();
      }
    } else if (transformerRef.current) {
      // Remove transformer if no shape is selected
      transformerRef.current.nodes([]);
      transformerRef.current.getLayer().batchDraw();
    }
  }, [selectedId]);
  
  // Handle scrolling events
  const handleWheel = (e) => {
    // Prevent default behavior
    e.evt.preventDefault();
    
    // Get current position
    const stage = stageRef.current;
    
    // Get the direction of the scroll
    const newY = stagePosition.y - e.evt.deltaY;
    
    // Calculate the boundaries to prevent scrolling beyond canvas
    const minY = -stageSize.height + window.innerHeight;
    const maxY = 0;
    
    // Apply the new position with boundaries
    setStagePosition({
      x: stagePosition.x,
      y: Math.min(maxY, Math.max(minY, newY))
    });
  };
  
  // Handle touch scrolling for tablets/mobile
  const handleTouchScroll = (e) => {
    if (isDrawing) return; // Don't scroll while drawing
    
    // Need at least two touches for pinch/zoom or scrolling
    if (e.evt.touches.length !== 2) return;
    
    e.evt.preventDefault();
    
    const touch1 = e.evt.touches[0];
    const touch2 = e.evt.touches[1];
    
    // Calculate the direction of movement
    const touchCenterY = (touch1.clientY + touch2.clientY) / 2;
    
    if (!stageRef.current.lastTouchCenterY) {
      stageRef.current.lastTouchCenterY = touchCenterY;
      return;
    }
    
    // Calculate movement delta
    const deltaY = stageRef.current.lastTouchCenterY - touchCenterY;
    stageRef.current.lastTouchCenterY = touchCenterY;
    
    // Update position
    const newY = stagePosition.y - deltaY * 2; // Multiply by 2 for more responsive scrolling
    
    // Calculate boundaries
    const minY = -stageSize.height + window.innerHeight;
    const maxY = 0;
    
    // Apply the new position with boundaries
    setStagePosition({
      x: stagePosition.x,
      y: Math.min(maxY, Math.max(minY, newY))
    });
  };
  
  // Reset touch center on touch end
  const handleTouchEnd = (e) => {
    setIsDrawing(false);
    
    if (!pages[currentPage]) return;
    
    if (tool === 'pen' || tool === 'eraser') {
      const currentLines = pages[currentPage].lines;
      if (currentLines && currentLines.length > 0) {
        // Send the last drawn line to the server
        socketRef.current.emit('draw', { 
          line: currentLines[currentLines.length - 1],
          page: currentPage
        });
      }
    } else if (tool === 'rect' || tool === 'circle') {
      const currentShapes = pages[currentPage].shapes;
      if (currentShapes && currentShapes.length > 0) {
        // Send the last created shape to the server
        socketRef.current.emit('shape', { 
          shape: currentShapes[currentShapes.length - 1],
          page: currentPage
        });
      }
    }
    
    // Reset touch center for scrolling
    if (stageRef.current) {
      stageRef.current.lastTouchCenterY = null;
    }
  };
  
  const handleMouseDown = (e) => {
    // Safety check - ensure the current page exists
    if (!pages[currentPage]) {
      console.error('Current page does not exist:', currentPage);
      return;
    }
    
    if (tool === 'select') {
      // Deselect when clicked on empty area
      const clickedOnEmpty = e.target === e.target.getStage();
      if (clickedOnEmpty) {
        setSelectedId(null);
        return;
      }
      
      // Check if clicked on a shape
      if (e.target.hasName('shape')) {
        setSelectedId(e.target.id());
        return;
      }
      return;
    }
    
    setIsDrawing(true);
    const pos = e.target.getStage().getPointerPosition();
    
    if (tool === 'pen' || tool === 'eraser') {
      const newLine = { 
        tool, 
        points: [pos.x, pos.y],
        stroke: tool === 'eraser' ? '#ffffff' : currentColor,
        strokeWidth: tool === 'eraser' ? 20 : currentStrokeWidth
      };
      setPages(prevPages => {
        const newPages = [...prevPages];
        newPages[currentPage].lines = [...newPages[currentPage].lines, newLine];
        return newPages;
      });
    } else if (tool === 'rect' || tool === 'circle') {
      const newShape = {
        id: Date.now().toString(),
        type: tool,
        x: pos.x,
        y: pos.y,
        width: 0,
        height: 0,
        fill: 'transparent',
        stroke: currentColor,
        strokeWidth: currentStrokeWidth,
        draggable: true
      };
      setPages(prevPages => {
        const newPages = [...prevPages];
        newPages[currentPage].shapes = [...newPages[currentPage].shapes, newShape];
        return newPages;
      });
    }
  };
  
  const handleMouseMove = (e) => {
    if (!isDrawing || !pages[currentPage]) return;
    
    const stage = e.target.getStage();
    const point = stage.getPointerPosition();
    
    if (tool === 'pen' || tool === 'eraser') {
      setPages(prevPages => {
        const newPages = [...prevPages];
        const lastLine = newPages[currentPage].lines[newPages[currentPage].lines.length - 1];
        lastLine.points = lastLine.points.concat([point.x, point.y]);
        return newPages;
      });
    } else if (tool === 'rect' || tool === 'circle') {
      setPages(prevPages => {
        const newPages = [...prevPages];
        const shapes = newPages[currentPage].shapes;
        const lastShape = shapes[shapes.length - 1];
        lastShape.width = point.x - lastShape.x;
        lastShape.height = point.y - lastShape.y;
        return newPages;
      });
    }
  };
  
  const handleMouseUp = () => {
    setIsDrawing(false);
    
    // Safety check - ensure the current page exists
    if (!pages[currentPage]) {
      console.error('Current page does not exist in handleMouseUp:', currentPage);
      return;
    }
    
    if (tool === 'pen' || tool === 'eraser') {
      const currentLines = pages[currentPage].lines;
      if (currentLines && currentLines.length > 0) {
        // Send the last drawn line to the server
        socketRef.current.emit('draw', { 
          line: currentLines[currentLines.length - 1],
          page: currentPage
        });
      }
    } else if (tool === 'rect' || tool === 'circle') {
      const currentShapes = pages[currentPage].shapes;
      if (currentShapes && currentShapes.length > 0) {
        // Send the last created shape to the server
        socketRef.current.emit('shape', { 
          shape: currentShapes[currentShapes.length - 1],
          page: currentPage
        });
      }
    }
  };
  
  const handleTouchStart = (e) => {
      e.evt.preventDefault();
      const stage = stageRef.current;
      const point = stage.getPointerPosition();
      
      if (tool === 'select') {
        // Handle selection for touch devices
        const touchedNode = e.target;
        if (touchedNode === stage) {
          setSelectedId(null);
        } else if (touchedNode.hasName('shape')) {
          setSelectedId(touchedNode.id());
        }
        return;
      }
      
      setIsDrawing(true);
      
      if (tool === 'pen' || tool === 'eraser') {
        const newLine = { 
          tool, 
          points: [point.x, point.y],
          stroke: tool === 'eraser' ? '#ffffff' : currentColor,
          strokeWidth: tool === 'eraser' ? 20 : currentStrokeWidth
        };
        setPages(prevPages => {
          const newPages = [...prevPages];
          newPages[currentPage].lines = [...newPages[currentPage].lines, newLine];
          return newPages;
        });
      } else if (tool === 'rect' || tool === 'circle') {
        const newShape = {
          id: Date.now().toString(),
          type: tool,
          x: point.x,
          y: point.y,
          width: 0,
          height: 0,
          fill: 'transparent',
          stroke: currentColor,
          strokeWidth: currentStrokeWidth,
          draggable: true
        };
        setPages(prevPages => {
          const newPages = [...prevPages];
          newPages[currentPage].shapes = [...newPages[currentPage].shapes, newShape];
          return newPages;
        });
      }
    };
    
  const handleTouchMove = (e) => {
    e.evt.preventDefault();
    
    // Handle multi-touch scrolling
    if (e.evt.touches.length === 2) {
      handleTouchScroll(e);
      return;
    }
    
    if (!isDrawing) return;
    
    const stage = stageRef.current;
    const point = stage.getPointerPosition();
    
    if (tool === 'pen' || tool === 'eraser') {
      setPages(prevPages => {
        const newPages = [...prevPages];
        const lastLine = newPages[currentPage].lines[newPages[currentPage].lines.length - 1];
        lastLine.points = lastLine.points.concat([point.x, point.y]);
        return newPages;
      });
    } else if (tool === 'rect' || tool === 'circle') {
      setPages(prevPages => {
        const newPages = [...prevPages];
        const shapes = newPages[currentPage].shapes;
        const lastShape = shapes[shapes.length - 1];
        lastShape.width = point.x - lastShape.x;
        lastShape.height = point.y - lastShape.y;
        return newPages;
      });
    }
  };
  
  const clearCanvas = () => {
    setPages(prevPages => {
      const newPages = [...prevPages];
      newPages[currentPage] = { lines: [], shapes: [] };
      return newPages;
    });
    socketRef.current.emit('clearCanvas', { page: currentPage });
  };
  
  const addNewPage = () => {
    // Create a new page with empty lines and shapes arrays
    const newPage = { lines: [], shapes: [] };
    
    // Update the pages state with the new page
    setPages(prevPages => {
      const updatedPages = [...prevPages, newPage];
      // Set the current page to the new page index immediately after updating
      setTimeout(() => {
        setCurrentPage(updatedPages.length - 1);
      }, 10);
      return updatedPages;
    });
    
    // Notify server about new page
    socketRef.current.emit('addPage');
  };
  
  // Modified changePage function
  const changePage = (pageIndex) => {
    // Make sure the page exists before changing to it
    if (pageIndex >= 0 && pageIndex < 12) {
      setCurrentPage(pageIndex);
      // Notify server about page change
      socketRef.current.emit('changePage', { page: pageIndex });
      
      // Reset scroll position when changing pages
      setStagePosition({ x: 0, y: 0 });
    }
  };
  
  const handleShapeTransform = (e) => {
    const shape = e.target;
    const id = shape.id();
    const shapeType = shape.attrs.type || shape.getClassName().toLowerCase();
    
    let updatedShape = {
      id,
      type: shapeType,
      draggable: true
    };
    
    if (shapeType === 'line') {
      // For line shapes, we need to transform all points
      const points = shape.points();
      const newPoints = [];
      
      // Apply transformation to each point
      for (let i = 0; i < points.length; i += 2) {
        const pos = shape.getAbsoluteTransform().point({ x: points[i], y: points[i + 1] });
        newPoints.push(pos.x, pos.y);
      }
      
      updatedShape = {
        ...updatedShape,
        points: newPoints,
        stroke: shape.attrs.stroke,
        strokeWidth: shape.attrs.strokeWidth
      };
    } else {
      // For other shapes (rect, circle, image)
      updatedShape = {
        ...updatedShape,
        x: shape.x(),
        y: shape.y(),
        width: shape.width() * shape.scaleX(),
        height: shape.height() * shape.scaleY(),
        rotation: shape.rotation(),
        fill: shape.attrs.fill,
        stroke: shape.attrs.stroke,
        strokeWidth: shape.attrs.strokeWidth,
        imageUrl: shape.attrs.imageUrl
      };
    }
    
    // Update local state
    setPages(prevPages => {
      const newPages = [...prevPages];
      const shapes = newPages[currentPage].shapes;
      const index = shapes.findIndex(s => s.id === id);
      
      if (index !== -1) {
        // Replace the entire shape object to avoid any reference issues
        shapes[index] = {
          ...shapes[index],
          ...updatedShape
        };
        
        // Reset scale after updating width and height
        shape.scaleX(1);
        shape.scaleY(1);
      }
      
      return newPages;
    });
    
    // Emit shape update to server with all necessary properties
    socketRef.current.emit('shapeUpdate', {
      shape: updatedShape,
      page: currentPage
    });
  };
  
  const handleImageUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = () => {
        const imageUrl = reader.result;
        const img = new window.Image();
        img.src = imageUrl;
        img.onload = () => {
          // Calculate aspect ratio to maintain when resizing to 300px width
          const aspectRatio = img.height / img.width;
          const newWidth = 300;
          const newHeight = 300 * aspectRatio;
          
          const newShape = {
            id: Date.now().toString(),
            type: 'image',
            x: 50,
            y: 50,
            width: newWidth,
            height: newHeight,
            imageUrl: imageUrl, // Store the image URL
            draggable: true
          };
          
          setPages(prevPages => {
            const newPages = [...prevPages];
            newPages[currentPage].shapes = [...newPages[currentPage].shapes, newShape];
            return newPages;
          });
          
          // Emit image upload to server
          socketRef.current.emit('shape', {
            shape: {
              ...newShape,
              // Don't send the actual image object, just the URL
              image: null
            },
            page: currentPage
          });
        };
      };
      reader.readAsDataURL(file);
    }
  };
  
  return (
    <div className="whiteboard-container" ref={containerRef}>
      {/* Add logo in the top right */}
      <div className="logo-container">
        <img src={logoImage} alt="Whiteboard Logo" className="app-logo" />
      </div>
      
      <div className="toolbar-left">
        <button 
          className={tool === 'pen' ? 'active' : ''} 
          onClick={() => setTool('pen')}
          title="Pen"
        >
          <img src={penIcon} alt="Pen" className="tool-icon" />
        </button>
        <button 
          className={tool === 'eraser' ? 'active' : ''} 
          onClick={() => setTool('eraser')}
          title="Eraser"
        >
          <img src={eraserIcon} alt="Eraser" className="tool-icon" />
        </button>
        <button 
          className={tool === 'rect' ? 'active' : ''} 
          onClick={() => setTool('rect')}
          title="Rectangle"
        >
          <img src={rectIcon} alt="Rectangle" className="tool-icon" />
        </button>
        <button 
          className={tool === 'circle' ? 'active' : ''} 
          onClick={() => setTool('circle')}
          title="Circle"
        >
          <img src={circleIcon} alt="Circle" className="tool-icon" />
        </button>
        <button 
          className={tool === 'select' ? 'active' : ''} 
          onClick={() => setTool('select')}
          title="Select"
        >
          <img src={selectIcon} alt="Select" className="tool-icon" />
        </button>
        <button onClick={clearCanvas} title="Clear Canvas">
          <img src={clearIcon} alt="Clear" className="tool-icon" />
        </button>
        <input
          type="file"
          id="imageUpload"
          style={{ display: 'none' }}
          accept="image/*"
          onChange={handleImageUpload}
        />
        <button 
          onClick={() => document.getElementById('imageUpload').click()}
          title="Upload Image"
        >
          <img src={imageIcon} alt="Upload Image" className="tool-icon" />
        </button>
        
        <div className="color-picker">
          <button 
            className="color-button" 
            style={{ backgroundColor: currentColor }}
            onClick={() => setShowColorPalette(!showColorPalette)}
            title="Color Picker"
          ></button>
          {showColorPalette && (
            <div className="color-palette">
              {colors.map((color, i) => (
                <div 
                  key={i} 
                  className="color-option" 
                  style={{ backgroundColor: color }}
                  onClick={() => {
                    setCurrentColor(color);
                    setShowColorPalette(false);
                  }}
                ></div>
              ))}
            </div>
          )}
        </div>
        
        <div className="stroke-picker">
          <button 
            className="stroke-button"
            onClick={() => setShowStrokePalette(!showStrokePalette)}
            title="Stroke Width"
          >
            <div style={{ 
              height: currentStrokeWidth, 
              backgroundColor: 'black',
              width: '20px',
              margin: '0 auto'
            }}></div>
          </button>
          {showStrokePalette && (
            <div className="stroke-palette">
              {strokeWidths.map((width, i) => (
                <div 
                  key={i} 
                  className="stroke-option"
                  onClick={() => {
                    setCurrentStrokeWidth(width);
                    setShowStrokePalette(false);
                  }}
                >
                  <div style={{ 
                    "--dot-size": `${width}px`,
                  }}></div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
      
      {/* Wrap the Stage in a div with scroll capability */}
      <div className="canvas-container">
        <Stage
          width={stageSize.width}
          height={stageSize.height}
          onMouseDown={handleMouseDown}
          onMousemove={handleMouseMove}
          onMouseup={handleMouseUp}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
          onWheel={handleWheel}
          ref={stageRef}
          style={{ border: '1px solid #ccc' }}
          x={stagePosition.x}
          y={stagePosition.y}
        >
          <Layer>
            {/* Render lines */}
            {pages[currentPage] && pages[currentPage].lines && pages[currentPage].lines.map((line, i) => (
              <Line
                key={i}
                points={line.points}
                stroke={line.stroke}
                strokeWidth={line.strokeWidth}
                tension={0.5}
                lineCap="round"
                lineJoin="round"
                globalCompositeOperation={
                  line.tool === 'eraser' ? 'destination-out' : 'source-over'
                }
              />
            ))}
            
            {/* Render shapes with proper attributes */}
            {pages[currentPage] && pages[currentPage].shapes && pages[currentPage].shapes.map((shape, i) => {
              if (shape.type === 'rect') {
                return (
                  <Rect
                    key={i}
                    id={shape.id}
                    x={shape.x}
                    y={shape.y}
                    width={shape.width}
                    height={shape.height}
                    fill={shape.fill}
                    stroke={shape.stroke}
                    strokeWidth={shape.strokeWidth}
                    draggable={tool === 'select'}
                    name="shape"
                    onTransformEnd={handleShapeTransform}
                    onDragEnd={handleShapeTransform}
                    onClick={() => tool === 'select' && setSelectedId(shape.id)}
                    onTap={() => tool === 'select' && setSelectedId(shape.id)}
                    rotation={shape.rotation || 0}
                    type="rect"
                  />
                );
              } else if (shape.type === 'circle') {
                return (
                  <Circle
                    key={i}
                    id={shape.id}
                    x={shape.x + shape.width / 2}
                    y={shape.y + shape.height / 2}
                    radius={Math.max(Math.abs(shape.width), Math.abs(shape.height)) / 2}
                    fill={shape.fill}
                    stroke={shape.stroke}
                    strokeWidth={shape.strokeWidth}
                    draggable={tool === 'select'}
                    name="shape"
                    onTransformEnd={handleShapeTransform}
                    onDragEnd={handleShapeTransform}
                    onClick={() => tool === 'select' && setSelectedId(shape.id)}
                    onTap={() => tool === 'select' && setSelectedId(shape.id)}
                    rotation={shape.rotation || 0}
                    type="circle"
                  />
                );
              } else if (shape.type === 'image') {
                // Create a new image object for each image shape
                const imageObj = new window.Image();
                imageObj.src = shape.imageUrl;
                
                return (
                  <Image
                    key={i}
                    id={shape.id}
                    x={shape.x}
                    y={shape.y}
                    width={shape.width}
                    height={shape.height}
                    image={imageObj}
                    draggable={tool === 'select'}
                    name="shape"
                    onTransformEnd={handleShapeTransform}
                    onDragEnd={handleShapeTransform}
                    onClick={() => tool === 'select' && setSelectedId(shape.id)}
                    onTap={() => tool === 'select' && setSelectedId(shape.id)}
                    rotation={shape.rotation || 0}
                    type="image"
                    imageUrl={shape.imageUrl}
                  />
                );
              }
              return null;
            })}
            
            {/* Transformer for selected shapes */}
            <Transformer
              ref={transformerRef}
              boundBoxFunc={(oldBox, newBox) => {
                // Limit resize to a minimum size
                if (newBox.width < 5 || newBox.height < 5) {
                  return oldBox;
                }
                return newBox;
              }}
              anchorSize={8}
              anchorCornerRadius={4}
              enabledAnchors={['top-left', 'top-right', 'bottom-left', 'bottom-right']}
              rotateEnabled={true}
          />
        </Layer>
      </Stage>
      
      <div className="page-controls">
        <button 
          onClick={() => changePage(Math.max(0, currentPage - 1))} 
          disabled={currentPage === 0}
          title="Previous Page"
        >
          <img src={prevIcon} alt="Previous" className="nav-icon" />
        </button>
        <span>Page {currentPage + 1} of 12</span>
        <button 
          onClick={() => changePage(Math.min(11, currentPage + 1))} 
          disabled={currentPage === 11}
          title="Next Page"
        >
          <img src={nextIcon} alt="Next" className="nav-icon" />
        </button>
        {/* Remove the "New Page" button */}
      </div>
    </div>
  );
};

export default Whiteboard;
