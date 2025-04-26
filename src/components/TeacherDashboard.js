import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Calendar, momentLocalizer } from 'react-big-calendar';
import moment from 'moment-timezone';
import 'react-big-calendar/lib/css/react-big-calendar.css';
// Add this import after the react-big-calendar CSS import
import './calendar-fix.css';
import { QRCodeCanvas } from 'qrcode.react';
import './TeacherDashboard.css';
import logoImage from '../assets/icons/logo.png';

// Setup the localizer for the calendar
const localizer = momentLocalizer(moment);

// List of common timezones
const timezones = [
  'Pacific/Honolulu', // Hawaii
  'America/Anchorage', // Alaska
  'America/Los_Angeles', // Pacific Time
  'America/Phoenix', // Mountain Time (no DST)
  'America/Denver', // Mountain Time
  'America/Chicago', // Central Time
  'America/New_York', // Eastern Time
  'America/Sao_Paulo', // Brazil
  'Europe/London', // UK
  'Europe/Paris', // Central Europe
  'Europe/Moscow', // Russia
  'Asia/Dubai', // UAE
  'Asia/Kolkata', // India
  'Asia/Shanghai', // China
  'Asia/Tokyo', // Japan
  'Asia/Seoul', // Korea
  'Australia/Sydney', // Australia
  'Pacific/Auckland', // New Zealand
  // Additional timezones to make 24 total
  'America/Halifax', // Atlantic Time
  'America/St_Johns', // Newfoundland
  'America/Mexico_City', // Mexico
  'Europe/Berlin', // Germany
  'Asia/Singapore', // Singapore
  'Pacific/Fiji', // Fiji
];

// Sample student data
const students = [
  { id: 1, name: 'John Doe', email: 'john.doe@example.com' },
  { id: 2, name: 'Jane Smith', email: 'jane.smith@example.com' },
  { id: 3, name: 'Bob Johnson', email: 'bob.johnson@example.com' },
  { id: 4, name: 'Alice Williams', email: 'alice.williams@example.com' },
  { id: 5, name: 'Charlie Brown', email: 'charlie.brown@example.com' },
];

const TeacherDashboard = () => {
  const navigate = useNavigate();
  const [selectedTimezone, setSelectedTimezone] = useState('America/Los_Angeles');
  const [events, setEvents] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [newEvent, setNewEvent] = useState({
    title: '',
    start: new Date(),
    end: new Date(new Date().getTime() + 60 * 60 * 1000), // 1 hour later
    students: [],
  });
  const [sessionLink, setSessionLink] = useState('');
  const [showShareModal, setShowShareModal] = useState(false);
  const [selectedStudent, setSelectedStudent] = useState(null);
  // Add error state for calendar
  const [calendarError, setCalendarError] = useState(false);
  // Add window width state
  const [windowWidth, setWindowWidth] = useState(window.innerWidth);
  
  // Add window resize handler
  useEffect(() => {
    const handleResize = () => {
      setWindowWidth(window.innerWidth);
    };
    
    window.addEventListener('resize', handleResize);
    return () => {
      window.removeEventListener('resize', handleResize);
    };
  }, []);

  // Check if user is logged in
  useEffect(() => {
    const user = JSON.parse(localStorage.getItem('user'));
    if (!user) {
      navigate('/login');
    }
  }, [navigate]);

  // Handle timezone change
  useEffect(() => {
    // Update displayed events when timezone changes
    moment.tz.setDefault(selectedTimezone);
  }, [selectedTimezone]);

  const handleLogout = () => {
    localStorage.removeItem('user');
    navigate('/login');
  };

  const handleSelectSlot = ({ start, end }) => {
    // Convert to the selected timezone
    const startTime = moment(start).tz(selectedTimezone).toDate();
    const endTime = moment(end).tz(selectedTimezone).toDate();
    
    setNewEvent({
      title: '',
      start: startTime,
      end: endTime,
      students: [],
    });
    setShowModal(true);
  };

  const handleSelectEvent = (event) => {
    // Show event details or allow editing
    setNewEvent(event);
    setSessionLink(`${window.location.origin}/whiteboard?session=${event.id}`);
    setShowShareModal(true);
  };

  const handleCreateSession = () => {
    if (!newEvent.title) {
      alert('Please enter a session title');
      return;
    }

    // Check for conflicts
    const hasConflict = events.some(event => {
      return (
        (newEvent.start >= event.start && newEvent.start < event.end) ||
        (newEvent.end > event.start && newEvent.end <= event.end) ||
        (newEvent.start <= event.start && newEvent.end >= event.end)
      );
    });

    if (hasConflict) {
      if (!window.confirm('There is a scheduling conflict. Do you want to continue anyway?')) {
        return;
      }
    }

    // Create a unique ID for the session
    const sessionId = Date.now().toString();
    const sessionUrl = `${window.location.origin}/whiteboard?session=${sessionId}`;
    
    const newSessionEvent = {
      ...newEvent,
      id: sessionId,
      url: sessionUrl,
    };

    setEvents([...events, newSessionEvent]);
    setSessionLink(sessionUrl);
    setShowModal(false);
    setShowShareModal(true);
  };

  const handleShareSession = () => {
    if (!selectedStudent) {
      alert('Please select a student to share with');
      return;
    }

    // Construct the email content
    const subject = encodeURIComponent(`Invitation to Whiteboard Session: ${newEvent.title}`);
    const body = encodeURIComponent(
      `Hello ${selectedStudent.name},\n\n` +
      `You are invited to join a whiteboard session: ${newEvent.title}\n\n` +
      `Date: ${moment(newEvent.start).format('MMMM Do YYYY, h:mm a')} - ${moment(newEvent.end).format('h:mm a')} (${selectedTimezone})\n\n` +
      `Click the link below to join:\n${sessionLink}\n\n` +
      `Looking forward to our session!\n\n` +
      `Best regards,\n${JSON.parse(localStorage.getItem('user')).email}`
    );

    // Open the default email client
    window.location.href = `mailto:${selectedStudent.email}?subject=${subject}&body=${body}`;
  };

  const copyLinkToClipboard = () => {
    navigator.clipboard.writeText(sessionLink);
    alert('Link copied to clipboard!');
  };

  // Add a function to validate events before rendering
  const validateEvents = () => {
    return events.map(event => ({
      title: event.title || 'Untitled Session',
      start: event.start || new Date(),
      end: event.end || new Date(new Date().getTime() + 60 * 60 * 1000),
      id: event.id || Date.now().toString(),
      students: event.students || [],
      url: event.url || `${window.location.origin}/whiteboard?session=${event.id || Date.now().toString()}`
    }));
  };

  // Function to test RTC connection
  const testRTCConnection = (sessionId) => {
    // Create a test connection URL
    const testUrl = `${window.location.origin}/whiteboard?session=${sessionId}&test=true`;
    
    // Open the whiteboard in a new window to test connection
    const testWindow = window.open(testUrl, '_blank');
    
    // Set a timeout to check if the connection was established
    setTimeout(() => {
      if (testWindow && !testWindow.closed) {
        console.log('RTC connection test initiated for session:', sessionId);
      }
    }, 2000);
  };

  // Add a function to handle calendar errors
  const handleCalendarError = (error) => {
    console.error("Calendar error:", error);
    setCalendarError(true);
  };

  // Add a function to determine the best view based on screen size
  const getCalendarView = () => {
    if (windowWidth < 768) {
      return "agenda"; // Use agenda view on mobile to avoid TimeGutter errors
    } else if (windowWidth < 1024) {
      return "day"; // Use day view on tablets
    } else {
      return "week"; // Use week view on desktops
    }
  };

  return (
    <div className="dashboard-container">
      <header className="dashboard-header">
        <div className="logo-section">
          <img src={logoImage} alt="Whiteboard Logo" className="dashboard-logo" />
          <h1>Teacher Dashboard</h1>
        </div>
        <div className="user-controls">
          <select 
            value={selectedTimezone} 
            onChange={(e) => setSelectedTimezone(e.target.value)}
            className="timezone-selector"
          >
            {timezones.map(tz => (
              <option key={tz} value={tz}>
                {tz.replace('_', ' ')} ({moment().tz(tz).format('Z')})
              </option>
            ))}
          </select>
          <button onClick={handleLogout} className="logout-button">Logout</button>
        </div>
      </header>

      <main className="dashboard-main">
        <div className="dashboard-layout">
          <div className="calendar-section">
            <h2>Schedule Sessions</h2>
            {calendarError ? (
              <div className="calendar-error">
                <p>There was an error loading the calendar. Please try a different view or timezone.</p>
                <button onClick={() => setCalendarError(false)}>Retry</button>
              </div>
            ) : (
              <Calendar
                localizer={localizer}
                events={validateEvents()} // Use validated events
                startAccessor="start"
                endAccessor="end"
                style={{ height: 400 }}
                selectable
                onSelectSlot={handleSelectSlot}
                onSelectEvent={handleSelectEvent}
                defaultView="month" // Use month view by default to avoid TimeGutter errors
                views={['month', 'agenda']} // Limit to simpler views that don't use TimeGutter
                step={60} // Increase step to reduce number of time slots
                timeslots={1} // Reduce timeslots to prevent array length errors
                min={new Date(new Date().setHours(9, 0, 0, 0))} // Narrower time range
                max={new Date(new Date().setHours(17, 0, 0, 0))} // Narrower time range
                onError={handleCalendarError}
                formats={{
                  // Simplify time format to reduce complexity
                  timeGutterFormat: (date, culture, localizer) =>
                    localizer.format(date, 'h A', culture),
                }}
                // Add error boundary props
                popup
                drilldownView={null}
                toolbar={true}
              />
            )}
          </div>
          
          <div className="sessions-section">
            <h2>Scheduled Sessions</h2>
            {events.length === 0 ? (
              <div className="no-sessions">
                <p>No sessions scheduled yet. Use the calendar to create new sessions.</p>
              </div>
            ) : (
              <div className="sessions-list">
                {events.sort((a, b) => a.start - b.start).map(event => (
                  <div key={event.id} className="session-card">
                    <div className="session-info">
                      <h3>{event.title}</h3>
                      <p className="session-date">
                        {moment(event.start).format('MMMM Do YYYY')}
                      </p>
                      <p className="session-time">
                        {moment(event.start).format('h:mm a')} - {moment(event.end).format('h:mm a')}
                      </p>
                      <p className="session-students">
                        Students: {event.students && event.students.length > 0 
                          ? event.students.map(s => s.name).join(', ') 
                          : 'None selected'}
                      </p>
                    </div>
                    <div className="session-actions">
                      <button 
                        className="join-button"
                        onClick={() => {
                          window.open(`${window.location.origin}/whiteboard?session=${event.id}`, '_blank');
                        }}
                      >
                        Join
                      </button>
                      <button 
                        className="share-button"
                        onClick={() => {
                          setNewEvent(event);
                          setSessionLink(`${window.location.origin}/whiteboard?session=${event.id}`);
                          setShowShareModal(true);
                        }}
                      >
                        Share
                      </button>
                      <button 
                        className="test-button"
                        onClick={() => testRTCConnection(event.id)}
                        title="Test RTC Connection"
                      >
                        Test
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </main>

      {/* Create Session Modal */}
      {showModal && (
        <div className="modal-overlay">
          <div className="modal-content">
            <h2>Create New Session</h2>
            <div className="form-group">
              <label>Session Title</label>
              <input
                type="text"
                value={newEvent.title}
                onChange={(e) => setNewEvent({...newEvent, title: e.target.value})}
                placeholder="Enter session title"
              />
            </div>
            
            <div className="form-group">
              <label>Start Time</label>
              <input
                type="datetime-local"
                value={moment(newEvent.start).format('YYYY-MM-DDTHH:mm')}
                onChange={(e) => {
                  const newStart = new Date(e.target.value);
                  setNewEvent({
                    ...newEvent, 
                    start: newStart,
                    end: new Date(newStart.getTime() + (newEvent.end - newEvent.start))
                  });
                }}
              />
            </div>
            
            <div className="form-group">
              <label>End Time</label>
              <input
                type="datetime-local"
                value={moment(newEvent.end).format('YYYY-MM-DDTHH:mm')}
                onChange={(e) => setNewEvent({...newEvent, end: new Date(e.target.value)})}
              />
            </div>
            
            <div className="form-group">
              <label>Select Students</label>
              <div className="student-list">
                {students.map(student => (
                  <div key={student.id} className="student-item">
                    <input
                      type="checkbox"
                      id={`student-${student.id}`}
                      checked={newEvent.students.some(s => s.id === student.id)}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setNewEvent({
                            ...newEvent,
                            students: [...newEvent.students, student]
                          });
                        } else {
                          setNewEvent({
                            ...newEvent,
                            students: newEvent.students.filter(s => s.id !== student.id)
                          });
                        }
                      }}
                    />
                    <label htmlFor={`student-${student.id}`}>{student.name} ({student.email})</label>
                  </div>
                ))}
              </div>
            </div>
            
            <div className="modal-actions">
              <button onClick={() => setShowModal(false)} className="cancel-button">Cancel</button>
              <button onClick={handleCreateSession} className="create-button">Create Session</button>
            </div>
          </div>
        </div>
      )}

      {/* Share Session Modal */}
      {showShareModal && (
        <div className="modal-overlay">
          <div className="modal-content">
            <h2>Share Session</h2>
            <div className="session-details">
              <h3>{newEvent.title}</h3>
              <p>
                <strong>Date:</strong> {moment(newEvent.start).format('MMMM Do YYYY')}
              </p>
              <p>
                <strong>Time:</strong> {moment(newEvent.start).format('h:mm a')} - {moment(newEvent.end).format('h:mm a')} ({selectedTimezone})
              </p>
            </div>
            
            <div className="session-link">
              <p><strong>Session Link:</strong></p>
              <div className="link-container">
                <input type="text" value={sessionLink} readOnly />
                <button onClick={copyLinkToClipboard} className="copy-button">Copy</button>
              </div>
            </div>
            
            <div className="qr-code-container">
              <p><strong>QR Code:</strong></p>
              <QRCodeCanvas value={sessionLink} size={150} />
            </div>
            
            <div className="form-group">
              <label>Share with Student</label>
              <select 
                value={selectedStudent ? selectedStudent.id : ''}
                onChange={(e) => {
                  const studentId = parseInt(e.target.value);
                  setSelectedStudent(students.find(s => s.id === studentId) || null);
                }}
              >
                <option value="">Select a student</option>
                {students.map(student => (
                  <option key={student.id} value={student.id}>
                    {student.name} ({student.email})
                  </option>
                ))}
              </select>
            </div>
            
            <div className="modal-actions">
              <button onClick={() => setShowShareModal(false)} className="cancel-button">Close</button>
              <button onClick={handleShareSession} className="share-button" disabled={!selectedStudent}>
                Share via Email
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TeacherDashboard;