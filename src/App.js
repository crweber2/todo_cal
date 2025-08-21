import React, { useState, useEffect, useCallback } from 'react';
import { Clock, Plus, X, Check, Edit2, Calendar, ChevronLeft, ChevronRight, GripVertical, Repeat, FileText, ArrowUp, ArrowDown, Eye, Zap, Bell, BellOff, Menu } from 'lucide-react';

// Custom hook for mobile detection
const useIsMobile = () => {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkIsMobile = () => {
      const width = window.innerWidth;
      const hasTouch = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
      const userAgent = navigator.userAgent.toLowerCase();
      const isMobileUA = /android|webos|iphone|ipad|ipod|blackberry|iemobile|opera mini/i.test(userAgent);
      
      // Consider mobile if screen width < 768px OR has touch + mobile user agent
      setIsMobile(width < 768 || (hasTouch && isMobileUA && width < 1024));
    };

    checkIsMobile();
    window.addEventListener('resize', checkIsMobile);
    return () => window.removeEventListener('resize', checkIsMobile);
  }, []);

  return isMobile;
};

const TodoCalendarApp = () => {
  // Mobile detection
  const isMobile = useIsMobile();
  
  // Mobile-specific state
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [touchDragState, setTouchDragState] = useState(null);
  const [swipeState, setSwipeState] = useState(null);
  
  // Calendar sync state
  const [calendarId, setCalendarId] = useState(null);
  const [isOnline, setIsOnline] = useState(true);
  const [lastSaved, setLastSaved] = useState(null);
  const [saveStatus, setSaveStatus] = useState('saved'); // 'saving', 'saved', 'error'

  // View state - default to day view on mobile
  const [viewMode, setViewMode] = useState(() => isMobile ? 'day' : 'week');
  const [selectedDay, setSelectedDay] = useState(0); // For day view

  // Initialize from localStorage or server
  const loadFromStorage = (key, defaultValue) => {
    if (typeof window !== 'undefined') {
      try {
        const item = window.localStorage.getItem(key);
        return item ? JSON.parse(item) : defaultValue;
      } catch (error) {
        console.error(`Error loading ${key} from localStorage:`, error);
        return defaultValue;
      }
    }
    return defaultValue;
  };

  const [tasks, setTasks] = useState(() => loadFromStorage('todo-tasks', [
    { id: 1, name: 'Review project proposal', duration: 60, color: '#3B82F6', notes: '' },
    { id: 2, name: 'Team standup', duration: 30, color: '#10B981', notes: '' },
    { id: 3, name: 'Email responses', duration: 45, color: '#F59E0B', notes: '' },
    { id: 4, name: 'Code review', duration: 90, color: '#8B5CF6', notes: '' },
    { id: 5, name: 'Documentation update', duration: 60, color: '#EC4899', notes: '' },
  ]));

  const [meetings, setMeetings] = useState(() => loadFromStorage('todo-meetings', [
    { id: 'm1', name: 'Client Meeting', weekOffset: 0, day: 0, startTime: 10, duration: 60, color: '#374151', notes: 'Discuss Q1 goals', recurring: false },
    { id: 'm2', name: 'Team Sync', weekOffset: 0, day: 1, startTime: 14.25, duration: 30, color: '#374151', notes: '', recurring: true, seriesId: 'series1' },
    { id: 'm3', name: 'Design Review', weekOffset: 0, day: 2, startTime: 11, duration: 90, color: '#374151', notes: 'Bring mockups', recurring: false },
  ]));

  const [scheduledTasks, setScheduledTasks] = useState(() => loadFromStorage('todo-scheduledTasks', []));
  const [completedTasks, setCompletedTasks] = useState(() => loadFromStorage('todo-completedTasks', []));
  const [struckThroughTasks, setStruckThroughTasks] = useState(() => new Set(loadFromStorage('todo-struckThroughTasks', [])));
  const [cancelledInstances, setCancelledInstances] = useState(() => new Set(loadFromStorage('todo-cancelledInstances', [])));

  const [draggedItem, setDraggedItem] = useState(null);
  const [draggedTaskIndex, setDraggedTaskIndex] = useState(null);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [editingItem, setEditingItem] = useState(null);
  const [showTaskModal, setShowTaskModal] = useState(false);
  const [showMeetingModal, setShowMeetingModal] = useState(false);
  const [showDebugModal, setShowDebugModal] = useState(false);
  const [newTask, setNewTask] = useState({ name: '', duration: 30, notes: '' });
  const [newMeeting, setNewMeeting] = useState({ name: '', day: 0, startTime: 9, duration: 60, notes: '', recurring: false });
  const [weekOffset, setWeekOffset] = useState(0);
  const [resizingItem, setResizingItem] = useState(null);
  const [quickMeetingPos, setQuickMeetingPos] = useState(null);
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  
  // Chime functionality
  const [chimeEnabled, setChimeEnabled] = useState(() => loadFromStorage('todo-chimeEnabled', true));
  const [lastChimeTime, setLastChimeTime] = useState(null);
  
  // Color mapping for consistent task colors based on first word
  const [colorMap, setColorMap] = useState(() => loadFromStorage('todo-colorMap', {}));

  // Utility to create a unique occurrence ID for a scheduled instance
  const createOccurrenceId = useCallback((base = 'occ') => {
    return `${base}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  }, []);

  // Check for calendar ID in URL on load, default to "001"
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    // Ensure we have a valid calendar ID, default to "001" if none provided or if "undefined"
    const id = urlParams.get('id') || '001';
    const validId = id === 'undefined' ? '001' : id;
    console.log('Calendar ID from URL:', id);
    console.log('Valid Calendar ID:', validId);
    setCalendarId(validId);
    // Update URL to reflect the actual calendar ID being used
    if (!urlParams.get('id') || id === 'undefined') {
      urlParams.set('id', validId);
      window.history.replaceState({}, '', `${window.location.pathname}?${urlParams.toString()}`);
    }
    loadCalendarFromServer(validId);
  }, []);

  // Migration: Ensure each scheduled task instance has an occurrenceId so we can manipulate instances independently
  useEffect(() => {
    const needsMigration = scheduledTasks.some(t => !t.occurrenceId);
    if (needsMigration) {
      setScheduledTasks(prev => prev.map(t => t.occurrenceId ? t : { ...t, occurrenceId: createOccurrenceId(String(t.id)) }));
    }
  }, [scheduledTasks, createOccurrenceId]);

  // Server sync functions
  const loadCalendarFromServer = async (id) => {
    try {
      console.log('Loading calendar from server with ID:', id);
      const response = await fetch(`/api/calendar/${id}`);
      console.log('Calendar load response:', response.status, response.statusText);
      if (response.ok) {
        const data = await response.json();
        console.log('Calendar data loaded:', data);
        setTasks(data.tasks || []);
        setMeetings(data.meetings || []);
        // Ensure server-loaded scheduled tasks also get occurrenceId
        const loadedScheduled = (data.scheduledTasks || []).map(t => t.occurrenceId ? t : { ...t, occurrenceId: `${t.id || 'occ'}_${Date.now()}_${Math.random().toString(36).slice(2, 6)}` });
        setScheduledTasks(loadedScheduled);
        setCompletedTasks(data.completedTasks || []);
        setCancelledInstances(new Set(data.cancelledInstances || []));
        setLastSaved(data.lastModified);
        setIsOnline(true);
      } else {
        console.error('Failed to load calendar from server:', response.status, response.statusText);
        setIsOnline(false);
      }
    } catch (error) {
      console.error('Failed to load calendar from server:', error);
      setIsOnline(false);
    }
  };

  const saveCalendarToServer = useCallback(async () => {
    if (!calendarId) return;
    
    try {
      setSaveStatus('saving');
      const data = {
        tasks,
        meetings,
        scheduledTasks,
        completedTasks,
        cancelledInstances: Array.from(cancelledInstances)
      };
      
      const response = await fetch(`/api/calendar/${calendarId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });
      
      if (response.ok) {
        const result = await response.json();
        setLastSaved(result.lastModified);
        setSaveStatus('saved');
        setIsOnline(true);
      } else {
        setSaveStatus('error');
        // Retry after 5 seconds on error
        setTimeout(() => {
          if (calendarId) {
            saveCalendarToServer();
          }
        }, 5000);
      }
    } catch (error) {
      console.error('Failed to save calendar to server:', error);
      setSaveStatus('error');
      setIsOnline(false);
      // Retry after 5 seconds on error
      setTimeout(() => {
        if (calendarId) {
          saveCalendarToServer();
        }
      }, 5000);
    }
  }, [calendarId, tasks, meetings, scheduledTasks, completedTasks, cancelledInstances]);

  // Auto-save to server when data changes - with conflict detection and change comparison
  useEffect(() => {
    if (!calendarId) return;
    
    const timeoutId = setTimeout(async () => {
      try {
        setSaveStatus('saving');
        const data = {
          tasks,
          meetings,
          scheduledTasks,
          completedTasks,
          cancelledInstances: Array.from(cancelledInstances),
          clientLastModified: lastSaved // Include client's last known timestamp
        };
        
        const response = await fetch(`/api/calendar/${calendarId}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data)
        });
        
        if (response.ok) {
          const result = await response.json();
          setLastSaved(result.lastModified);
          setSaveStatus('saved');
          setIsOnline(true);
          
          // Log if no changes were detected
          if (!result.hasChanges) {
            console.log('Auto-save skipped: No changes detected');
          }
        } else if (response.status === 409) {
          // Conflict detected
          const conflictData = await response.json();
          console.warn('Conflict detected:', conflictData.message);
          setSaveStatus('error');
          
          // Handle conflict - for now, reload the server data
          // In a more sophisticated implementation, you might show a merge UI
          if (conflictData.serverData) {
            console.log('Reloading server data due to conflict...');
            setTasks(conflictData.serverData.tasks || []);
            setMeetings(conflictData.serverData.meetings || []);
            setScheduledTasks((conflictData.serverData.scheduledTasks || []).map(t => t.occurrenceId ? t : { ...t, occurrenceId: `${t.id || 'occ'}_${Date.now()}_${Math.random().toString(36).slice(2, 6)}` }));
            setCompletedTasks(conflictData.serverData.completedTasks || []);
            setCancelledInstances(new Set(conflictData.serverData.cancelledInstances || []));
            setLastSaved(conflictData.serverLastModified);
            setSaveStatus('saved');
            
            // Show user notification about the conflict
            alert('Your calendar was updated by another browser. Your changes have been overridden with the latest version.');
          }
        } else {
          setSaveStatus('error');
          // Retry after 5 seconds on error
          setTimeout(async () => {
            if (calendarId) {
              try {
                const retryResponse = await fetch(`/api/calendar/${calendarId}`, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify(data)
                });
                if (retryResponse.ok) {
                  const retryResult = await retryResponse.json();
                  setLastSaved(retryResult.lastModified);
                  setSaveStatus('saved');
                  setIsOnline(true);
                }
              } catch (retryError) {
                console.error('Retry save failed:', retryError);
              }
            }
          }, 5000);
        }
      } catch (error) {
        console.error('Failed to save calendar to server:', error);
        setSaveStatus('error');
        setIsOnline(false);
        // Retry after 5 seconds on error
        setTimeout(async () => {
          if (calendarId) {
            try {
              const data = {
                tasks,
                meetings,
                scheduledTasks,
                completedTasks,
                cancelledInstances: Array.from(cancelledInstances),
                clientLastModified: lastSaved
              };
              const retryResponse = await fetch(`/api/calendar/${calendarId}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
              });
              if (retryResponse.ok) {
                const retryResult = await retryResponse.json();
                setLastSaved(retryResult.lastModified);
                setSaveStatus('saved');
                setIsOnline(true);
              }
            } catch (retryError) {
              console.error('Retry save failed:', retryError);
            }
          }
        }, 5000);
      }
    }, 2000); // Save 2 seconds after last change
    
    return () => clearTimeout(timeoutId);
  }, [tasks, meetings, scheduledTasks, completedTasks, cancelledInstances, calendarId, lastSaved]);

  // Save to localStorage whenever data changes (backup)
  useEffect(() => {
    if (typeof window !== 'undefined') {
      try {
        window.localStorage.setItem('todo-tasks', JSON.stringify(tasks));
      } catch (error) {
        console.error('Error saving tasks to localStorage:', error);
      }
    }
  }, [tasks]);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      try {
        window.localStorage.setItem('todo-meetings', JSON.stringify(meetings));
      } catch (error) {
        console.error('Error saving meetings to localStorage:', error);
      }
    }
  }, [meetings]);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      try {
        window.localStorage.setItem('todo-scheduledTasks', JSON.stringify(scheduledTasks));
      } catch (error) {
        console.error('Error saving scheduledTasks to localStorage:', error);
      }
    }
  }, [scheduledTasks]);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      try {
        window.localStorage.setItem('todo-completedTasks', JSON.stringify(completedTasks));
      } catch (error) {
        console.error('Error saving completedTasks to localStorage:', error);
      }
    }
  }, [completedTasks]);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      try {
        window.localStorage.setItem('todo-struckThroughTasks', JSON.stringify(Array.from(struckThroughTasks)));
      } catch (error) {
        console.error('Error saving struckThroughTasks to localStorage:', error);
      }
    }
  }, [struckThroughTasks]);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      try {
        window.localStorage.setItem('todo-cancelledInstances', JSON.stringify(Array.from(cancelledInstances)));
      } catch (error) {
        console.error('Error saving cancelledInstances to localStorage:', error);
      }
    }
  }, [cancelledInstances]);

  // Save chime preference to localStorage
  useEffect(() => {
    if (typeof window !== 'undefined') {
      try {
        window.localStorage.setItem('todo-chimeEnabled', JSON.stringify(chimeEnabled));
      } catch (error) {
        console.error('Error saving chimeEnabled to localStorage:', error);
      }
    }
  }, [chimeEnabled]);

  // Save color map to localStorage
  useEffect(() => {
    if (typeof window !== 'undefined') {
      try {
        window.localStorage.setItem('todo-colorMap', JSON.stringify(colorMap));
      } catch (error) {
        console.error('Error saving colorMap to localStorage:', error);
      }
    }
  }, [colorMap]);

  // Get meetings for current week (including recurring)
  const getVisibleMeetings = useCallback(() => {
    const visible = [];
    
    meetings.forEach(meeting => {
      const instanceKey = `${meeting.id || meeting.seriesId}-week${weekOffset}`;
      
      if (!cancelledInstances.has(instanceKey)) {
        if (meeting.recurring) {
          // Show recurring meetings in every week
          visible.push({ ...meeting, weekOffset, instanceKey });
        } else if (meeting.weekOffset === weekOffset) {
          // Show non-recurring meetings only in their specific week
          visible.push({ ...meeting, instanceKey });
        }
      }
    });
    
    return visible;
  }, [meetings, weekOffset, cancelledInstances]);

  // Create audio context for chime
  const playChime = useCallback(() => {
    if (!chimeEnabled) return;
    
    try {
      // Create a simple chime sound using Web Audio API
      const audioContext = new (window.AudioContext || window.webkitAudioContext)();
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();
      
      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);
      
      // Create a pleasant chime sound (C major chord)
      oscillator.frequency.setValueAtTime(523.25, audioContext.currentTime); // C5
      oscillator.frequency.setValueAtTime(659.25, audioContext.currentTime + 0.1); // E5
      oscillator.frequency.setValueAtTime(783.99, audioContext.currentTime + 0.2); // G5
      
      gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 1);
      
      oscillator.start(audioContext.currentTime);
      oscillator.stop(audioContext.currentTime + 1);
    } catch (error) {
      console.error('Error playing chime:', error);
    }
  }, [chimeEnabled]);

  // Update current time every minute and check for chime notifications
  useEffect(() => {
    const timer = setInterval(() => {
      const newTime = new Date();
      setCurrentTime(newTime);
      
      if (!chimeEnabled || weekOffset !== 0) return;
      
      const currentDay = newTime.getDay() - 1; // 0 = Monday
      const currentHour = newTime.getHours() + newTime.getMinutes() / 60;
      const currentMinute = newTime.getMinutes();
      
      // Only check on the minute mark to avoid duplicate chimes
      if (currentMinute === 0 || currentMinute === 5 || currentMinute === 10 || 
          currentMinute === 15 || currentMinute === 20 || currentMinute === 25 || 
          currentMinute === 30 || currentMinute === 35 || currentMinute === 40 || 
          currentMinute === 45 || currentMinute === 50 || currentMinute === 55) {
        
        const currentWeekTasks = scheduledTasks.filter(t => t.weekOffset === weekOffset);
        const currentWeekMeetings = getVisibleMeetings();
        const allScheduled = [...currentWeekTasks, ...currentWeekMeetings];
        
        for (const task of allScheduled) {
          if (task.day !== currentDay) continue;
          
          const taskEndTime = task.startTime + task.duration / 60;
          const fiveMinutesBeforeEnd = taskEndTime - (5 / 60);
          
          // Chime 5 minutes before task completion
          if (Math.abs(currentHour - fiveMinutesBeforeEnd) < 0.02) { // Within ~1 minute tolerance
            const chimeKey = `${task.id}-${task.weekOffset || 0}-5min-${Math.floor(fiveMinutesBeforeEnd * 60)}`;
            if (lastChimeTime !== chimeKey) {
              playChime();
              setLastChimeTime(chimeKey);
              console.log(`Chime: 5 minutes until ${task.name} ends`);
            }
          }
          
          // Chime at task start
          if (Math.abs(currentHour - task.startTime) < 0.02) { // Within ~1 minute tolerance
            const chimeKey = `${task.id}-${task.weekOffset || 0}-start-${Math.floor(task.startTime * 60)}`;
            if (lastChimeTime !== chimeKey) {
              playChime();
              setLastChimeTime(chimeKey);
              console.log(`Chime: ${task.name} is starting`);
            }
          }
        }
      }
    }, 60000);
    return () => clearInterval(timer);
  }, [chimeEnabled, weekOffset, scheduledTasks, getVisibleMeetings, lastChimeTime, playChime]);

  // Get week dates
  const getWeekDates = () => {
    const dates = [];
    const today = new Date();
    const monday = new Date(today);
    monday.setDate(today.getDate() - today.getDay() + 1 + (weekOffset * 7));
    
    for (let i = 0; i < 5; i++) {
      const date = new Date(monday);
      date.setDate(monday.getDate() + i);
      dates.push(date);
    }
    return dates;
  };

  const weekDates = getWeekDates();
  const dayNames = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
  const hours = Array.from({ length: 14 }, (_, i) => i + 6); // 6 AM to 7 PM for day view
  const weekHours = Array.from({ length: 10 }, (_, i) => i + 8); // 8 AM to 5 PM for week view

  // Convert time to 15-minute slots
  const timeToSlot = (time) => Math.floor(time * 4) / 4;
  const formatTime = (time) => {
    const hour = Math.floor(time);
    const minutes = Math.round((time - hour) * 60);
    const period = hour >= 12 ? 'PM' : 'AM';
    const displayHour = hour > 12 ? hour - 12 : hour === 0 ? 12 : hour;
    return `${displayHour}:${minutes.toString().padStart(2, '0')} ${period}`;
  };

  // Get current time position
  const getCurrentTimePosition = () => {
    const now = currentTime;
    const currentDay = now.getDay() - 1; // 0 = Monday
    const currentHour = now.getHours() + now.getMinutes() / 60;
    
    if (weekOffset === 0 && currentDay >= 0 && currentDay < 5) {
      const minHour = viewMode === 'day' ? 6 : 8;
      const maxHour = viewMode === 'day' ? 20 : 18;
      
      if (currentHour >= minHour && currentHour <= maxHour) {
        return {
          day: currentDay,
          position: (currentHour - minHour) * pixelsPerHour
        };
      }
    }
    return null;
  };

  // Get current and next task with countdown
  const getCurrentAndNextTask = () => {
    const now = currentTime;
    const currentDay = now.getDay() - 1; // 0 = Monday
    const currentHour = now.getHours() + now.getMinutes() / 60;
    
    let currentTasks = [];
    let nextTask = null;
    let timeRemaining = null;
    
    const currentWeekTasks = scheduledTasks.filter(t => t.weekOffset === weekOffset);
    const currentWeekMeetings = getVisibleMeetings();
    
    const allScheduled = [...currentWeekTasks, ...currentWeekMeetings].sort((a, b) => {
      if (a.day !== b.day) return a.day - b.day;
      return a.startTime - b.startTime;
    });
    
    for (const task of allScheduled) {
      const taskEndTime = task.startTime + task.duration / 60;
      
      if (weekOffset === 0 && task.day === currentDay && task.startTime <= currentHour && taskEndTime > currentHour) {
        currentTasks.push(task);
        // Calculate time remaining for the first current task
        if (currentTasks.length === 1) {
          const remainingHours = taskEndTime - currentHour;
          const remainingMinutes = Math.ceil(remainingHours * 60);
          timeRemaining = remainingMinutes;
        }
      } else if (weekOffset === 0 && (task.day > currentDay || (task.day === currentDay && task.startTime > currentHour))) {
        if (!nextTask) nextTask = task;
      } else if (weekOffset > 0 && !nextTask) {
        nextTask = task;
      }
    }
    
    return { currentTasks, nextTask, timeRemaining };
  };


  // Increased pixels per hour for better visibility of short tasks
  const pixelsPerHour = viewMode === 'day' ? 120 : 80; // Day view: 120px/hour, Week view: 80px/hour

  const { currentTasks, nextTask, timeRemaining } = getCurrentAndNextTask();

  // Calculate overlapping items for side-by-side display
  const getOverlappingItems = (day) => {
    const currentWeekTasks = scheduledTasks.filter(t => t.weekOffset === weekOffset);
    const currentWeekMeetings = getVisibleMeetings();
    
    const dayItems = [
      ...currentWeekTasks.filter(t => t.day === day),
      ...currentWeekMeetings.filter(m => m.day === day)
    ].sort((a, b) => a.startTime - b.startTime);

    // Reset all items
    dayItems.forEach(item => {
      item.column = 0;
      item.totalColumns = 1;
    });

    // Find overlapping groups
    const groups = [];
    let currentGroup = [];

    dayItems.forEach(item => {
      if (currentGroup.length === 0) {
        currentGroup.push(item);
      } else {
        const groupEnd = Math.max(...currentGroup.map(i => i.startTime + i.duration / 60));
        if (item.startTime < groupEnd) {
          currentGroup.push(item);
        } else {
          groups.push([...currentGroup]);
          currentGroup = [item];
        }
      }
    });

    if (currentGroup.length > 0) {
      groups.push(currentGroup);
    }

    // Smart column assignment for each group
    groups.forEach(group => {
      if (group.length <= 1) {
        // Single item, no overlap
        group[0].column = 0;
        group[0].totalColumns = 1;
        return;
      }

      // Check if items can be stacked vertically instead of side-by-side
      const canStack = (item1, item2) => {
        const item1End = item1.startTime + item1.duration / 60;
        const item2End = item2.startTime + item2.duration / 60;
        return item1End <= item2.startTime || item2End <= item1.startTime;
      };

      // Try to find items that can share columns
      const columns = [];
      
      group.forEach(item => {
        let assignedColumn = -1;
        
        // Try to find an existing column where this item can fit
        for (let colIndex = 0; colIndex < columns.length; colIndex++) {
          const canFitInColumn = columns[colIndex].every(colItem => canStack(item, colItem));
          if (canFitInColumn) {
            assignedColumn = colIndex;
            break;
          }
        }
        
        // If no existing column works, create a new one
        if (assignedColumn === -1) {
          assignedColumn = columns.length;
          columns.push([]);
        }
        
        columns[assignedColumn].push(item);
        item.column = assignedColumn;
      });
      
      // Set total columns for all items in this group
      const totalColumns = columns.length;
      group.forEach(item => {
        item.totalColumns = totalColumns;
      });
    });

    return dayItems;
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDropToUnscheduled = (e) => {
    e.preventDefault();
    if (!draggedItem) return;

    if (draggedItem.source === 'scheduled') {
      // Remove only the dragged occurrence (not all with same id)
      setScheduledTasks(prev => prev.filter(t => t.occurrenceId !== draggedItem.occurrenceId));
    }

    setDraggedItem(null);
  };

  const handleDropToCompleted = (e) => {
    e.preventDefault();
    if (!draggedItem) return;

    if (draggedItem.source === 'scheduled') {
      // Complete the linked task: remove all instances of this id for this week and add a single completed entry
      const anyInstance = scheduledTasks.find(t => t.id === draggedItem.id && t.weekOffset === draggedItem.weekOffset);
      if (anyInstance) {
        setScheduledTasks(prev => prev.filter(t => !(t.id === draggedItem.id && t.weekOffset === draggedItem.weekOffset)));
        const lastDate = getLastOccurrenceDateForTask(anyInstance.id);
        setCompletedTasks(prev => {
          const exists = prev.some(t => t.id === anyInstance.id);
          return exists ? prev : [...prev, { ...anyInstance, completedAt: lastDate }];
        });
      }
    } else if (draggedItem.source === 'unscheduled') {
      setCompletedTasks(prev => {
        const exists = prev.some(t => t.id === draggedItem.id);
        return exists ? prev : [...prev, { ...draggedItem, completedAt: new Date() }];
      });
    }

    setDraggedItem(null);
  };

  const handleDoubleClickCalendar = (e, day, hour) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const y = e.clientY - rect.top;
    const quarterHour = Math.floor(y / (pixelsPerHour / 4)) * 0.25;
    const startTime = timeToSlot(hour + quarterHour);
    
    setQuickMeetingPos({ day, startTime });
    setNewMeeting({ name: '', day, startTime, duration: 60, notes: '', recurring: false });
    setShowMeetingModal(true);
  };

  const handleResizeStart = (e, item, type) => {
    e.stopPropagation();
    e.preventDefault();
    setResizingItem({ item, type, startY: e.clientY, originalDuration: item.duration });
  };

  useEffect(() => {
    const handleMouseMove = (e) => {
      if (resizingItem) {
        const deltaY = e.clientY - resizingItem.startY;
        const durationChange = Math.round(deltaY / (pixelsPerHour / 4)) * 15;
        const newDuration = Math.max(15, resizingItem.originalDuration + durationChange);
        
        if (resizingItem.type === 'task') {
          // Resize only this occurrence
          setScheduledTasks(prev => prev.map(t => 
            t.occurrenceId === resizingItem.item.occurrenceId
              ? { ...t, duration: newDuration } 
              : t
          ));
        } else if (resizingItem.type === 'meeting') {
          setMeetings(prev => prev.map(m => 
            m.id === resizingItem.item.id ? { ...m, duration: newDuration } : m
          ));
        }
      }
    };

    const handleMouseUp = () => {
      setResizingItem(null);
    };

    if (resizingItem) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      return () => {
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [resizingItem, pixelsPerHour]);

  const handleCompleteTask = (taskId) => {
    // Find any instance for this week
    const task = scheduledTasks.find(t => t.id === taskId && t.weekOffset === weekOffset);
    if (task) {
      // Remove all instances with the same id in this week
      setScheduledTasks(prev => prev.filter(t => !(t.id === taskId && t.weekOffset === weekOffset)));
      // Add only one completion entry (attribute to the last scheduled occurrence date)
      const lastDate = getLastOccurrenceDateForTask(taskId);
      setCompletedTasks(prev => {
        const exists = prev.some(t => t.id === task.id);
        return exists ? prev : [...prev, { ...task, completedAt: lastDate }];
      });
    }
  };

  const handleUnscheduleTask = (taskId, occurrenceId) => {
    // Remove only this occurrence from scheduled tasks
    const task = scheduledTasks.find(t => t.occurrenceId === occurrenceId);
    if (task) {
      setScheduledTasks(prev => prev.filter(t => t.occurrenceId !== occurrenceId));
      
      // Check if this task exists in the main tasks array
      const existsInTasks = tasks.some(t => t.id === taskId);
      if (!existsInTasks) {
        const { day, startTime, weekOffset: _, occurrenceId: __, ...taskWithoutScheduleInfo } = task;
        setTasks(prev => [...prev, taskWithoutScheduleInfo]);
      }
    }
  };

  // New handler functions for enhanced task icons
  const handleStrikeThroughTask = (taskId) => {
    const task = scheduledTasks.find(t => t.id === taskId && t.weekOffset === weekOffset);
    if (task) {
      const isCurrentlyStruckThrough = struckThroughTasks.has(taskId);
      
      if (isCurrentlyStruckThrough) {
        // Un-strike-through: remove from struck through tasks and completed tasks
        setStruckThroughTasks(prev => {
          const newSet = new Set(prev);
          newSet.delete(taskId);
          return newSet;
        });
        setCompletedTasks(prev => prev.filter(t => t.id !== taskId));
      } else {
        // Strike through: add to struck through tasks and completed tasks
        setStruckThroughTasks(prev => new Set([...prev, taskId]));
        const lastDate = getLastOccurrenceDateForTask(task.id);
        setCompletedTasks(prev => {
          const exists = prev.some(t => t.id === task.id);
          return exists ? prev : [...prev, { ...task, completedAt: lastDate }];
        });
      }
    }
  };

  const handleDeleteTask = (taskId) => {
    // Permanently remove this task everywhere
    setTasks(prev => prev.filter(t => t.id !== taskId));
    setScheduledTasks(prev => prev.filter(t => t.id !== taskId));
    setCompletedTasks(prev => prev.filter(t => t.id !== taskId));
    setStruckThroughTasks(prev => {
      const newSet = new Set(prev);
      newSet.delete(taskId);
      return newSet;
    });
  };

  const handleDeleteOccurrence = (taskId, occurrenceId) => {
    // Remove only this scheduled instance
    setScheduledTasks(prev => prev.filter(t => !(t.id === taskId && t.occurrenceId === occurrenceId)));
  };

  // Right-click context menu handler
  const handleRightClickCalendar = (e, day, hour) => {
    e.preventDefault();
    const rect = e.currentTarget.getBoundingClientRect();
    const y = e.clientY - rect.top;
    const quarterHour = Math.floor(y / (pixelsPerHour / 4)) * 0.25;
    const startTime = timeToSlot(hour + quarterHour);
    
    // Create a new task template but don't add it to scheduled tasks yet
    const newTask = {
      id: Date.now(),
      name: '',
      duration: 30,
      notes: '',
      color: '#3B82F6', // Default color, will be updated when name is set
      day,
      startTime,
      weekOffset,
      isNewRightClickTask: true // Flag to indicate this is a new right-click task
    };
    
    // Open edit modal for the new task without adding it to scheduled tasks yet
    setEditingItem(newTask);
  };

  // Touch drag handlers for mobile
  const handleTouchStart = (e, item, source) => {
    if (!isMobile) return;
    
    const touch = e.touches[0];
    setTouchDragState({
      item: { ...item, source },
      startX: touch.clientX,
      startY: touch.clientY,
      currentX: touch.clientX,
      currentY: touch.clientY,
      isDragging: false,
      longPressTimer: setTimeout(() => {
        setTouchDragState(prev => prev ? { ...prev, isDragging: true } : null);
        // Haptic feedback if available
        if (navigator.vibrate) {
          navigator.vibrate(50);
        }
      }, 500) // 500ms long press
    });
  };

  const handleTouchMove = (e, item, source) => {
    if (!isMobile || !touchDragState) return;
    
    e.preventDefault();
    const touch = e.touches[0];
    
    setTouchDragState(prev => ({
      ...prev,
      currentX: touch.clientX,
      currentY: touch.clientY
    }));
  };

  const handleTouchEnd = (e, item, source) => {
    if (!isMobile || !touchDragState) return;
    
    clearTimeout(touchDragState.longPressTimer);
    
    if (touchDragState.isDragging) {
      // Find drop target based on touch position
      const elementBelow = document.elementFromPoint(touchDragState.currentX, touchDragState.currentY);
      
      if (elementBelow) {
        // Check if dropped on calendar
        const calendarCell = elementBelow.closest('[data-calendar-cell]');
        if (calendarCell) {
          const day = parseInt(calendarCell.dataset.day);
          const hour = parseInt(calendarCell.dataset.hour);
          
          // Simulate drop event
          const syntheticEvent = {
            preventDefault: () => {},
            clientY: touchDragState.currentY,
            currentTarget: calendarCell,
            shiftKey: false // Mobile: no shift-duplicate
          };
          
          setDraggedItem(touchDragState.item);
          handleEnhancedDrop(syntheticEvent, day, hour);
        }
      }
    } else {
      // Short tap - edit item
      handleEditItem(item);
    }
    
    setTouchDragState(null);
  };

  // Swipe navigation handlers for mobile
  const handleSwipeStart = (e) => {
    if (!isMobile || viewMode !== 'day') return;
    
    const touch = e.touches[0];
    setSwipeState({
      startX: touch.clientX,
      startY: touch.clientY,
      startTime: Date.now()
    });
  };

  const handleSwipeMove = (e) => {
    if (!isMobile || !swipeState || viewMode !== 'day') return;
    
    const touch = e.touches[0];
    const deltaX = touch.clientX - swipeState.startX;
    const deltaY = touch.clientY - swipeState.startY;
    
    // If vertical movement is greater than horizontal, don't interfere with scrolling
    if (Math.abs(deltaY) > Math.abs(deltaX)) {
      return;
    }
    
    // Prevent horizontal scrolling during swipe
    if (Math.abs(deltaX) > 10) {
      e.preventDefault();
    }
  };

  const handleSwipeEnd = (e) => {
    if (!isMobile || !swipeState || viewMode !== 'day') return;
    
    const touch = e.changedTouches[0];
    const deltaX = touch.clientX - swipeState.startX;
    const deltaY = touch.clientY - swipeState.startY;
    const deltaTime = Date.now() - swipeState.startTime;
    
    // Only process swipe if it's primarily horizontal and fast enough
    if (Math.abs(deltaX) > Math.abs(deltaY) && 
        Math.abs(deltaX) > 50 && 
        deltaTime < 500) {
      
      if (deltaX > 0) {
        // Swipe right - go to previous day
        handleDayNavigation('prev');
      } else {
        // Swipe left - go to next day
        handleDayNavigation('next');
      }
      
      // Haptic feedback for successful swipe
      if (navigator.vibrate) {
        navigator.vibrate(30);
      }
    }
    
    setSwipeState(null);
  };

  // Enhanced drag handlers with shift-copy functionality
  const handleEnhancedDragStart = (e, item, source) => {
    if (isMobile) return; // Use touch handlers on mobile
    // Include occurrenceId when dragging scheduled items so we can target a single instance
    setDraggedItem({ ...item, source });
    e.dataTransfer.effectAllowed = 'copyMove';
  };

  const handleEnhancedDrop = (e, day, hour) => {
    e.preventDefault();
    if (!draggedItem) return;

    const rect = e.currentTarget.getBoundingClientRect();
    const y = e.clientY - rect.top;
    const quarterHour = Math.floor(y / (pixelsPerHour / 4)) * 0.25;
    const startTime = timeToSlot(hour + quarterHour);

    // Check if shift key is pressed at drop time
    const isShiftPressed = e.shiftKey;

    if (draggedItem.source === 'meeting') {
      // Meetings keep existing behavior
      if (isShiftPressed) {
        const newMeeting = {
          ...draggedItem,
          id: `m${Date.now()}`,
          day,
          startTime,
          weekOffset,
          color: '#374151'
        };
        const { source, ...clean } = newMeeting;
        setMeetings(prev => [...prev, clean]);
      } else {
        setMeetings(prev => prev.map(m => 
          m.id === draggedItem.id 
            ? { ...m, day, startTime, weekOffset }
            : m
        ));
      }
    } else {
      // Tasks
      if (isShiftPressed) {
        // Linked duplicate: keep the SAME task id, just add another scheduled instance with a new occurrenceId
        const newScheduledItem = {
          ...draggedItem,
          day,
          startTime,
          weekOffset,
          occurrenceId: createOccurrenceId(String(draggedItem.id))
        };
        const { source, completedAt, ...clean } = newScheduledItem;
        setScheduledTasks(prev => [...prev, clean]);
      } else {
        if (draggedItem.source === 'scheduled') {
          // Move only this occurrence
          setScheduledTasks(prev => prev.map(t => 
            t.occurrenceId === draggedItem.occurrenceId
              ? { ...t, day, startTime, weekOffset }
              : t
          ));
        } else if (draggedItem.source === 'completed') {
          // Move from completed back to schedule: add one instance
          setCompletedTasks(prev => prev.filter(t => t.id !== draggedItem.id));
          const newScheduledItem = {
            ...draggedItem,
            day,
            startTime,
            weekOffset,
            occurrenceId: createOccurrenceId(String(draggedItem.id))
          };
          const { source, completedAt, ...clean } = newScheduledItem;
          setScheduledTasks(prev => [...prev, clean]);
        } else {
          // From unscheduled: add one instance
          const newScheduledItem = {
            ...draggedItem,
            day,
            startTime,
            weekOffset,
            occurrenceId: createOccurrenceId(String(draggedItem.id))
          };
          const { source, ...clean } = newScheduledItem;
          setScheduledTasks(prev => [...prev, clean]);
        }
      }
    }

    setDraggedItem(null);
  };

  // Function to check if time slot is in the past
  const isTimeSlotPast = (dayIndex, hour) => {
    if (weekOffset !== 0) return false; // Only grey out current week
    
    const now = currentTime;
    const currentDay = now.getDay() - 1; // 0 = Monday
    const currentHour = now.getHours() + now.getMinutes() / 60;
    
    // Consistently grey out all past time slots
    return dayIndex < currentDay || (dayIndex === currentDay && hour < currentHour);
  };

  const handleUncompleteTask = (taskId) => {
    // Remove from completed
    setCompletedTasks(prev => prev.filter(t => t.id !== taskId));

    // Restore to Tasks if not present
    const completed = completedTasks.find(t => t.id === taskId);
    if (completed) {
      setTasks(prev => {
        const exists = prev.some(t => t.id === taskId);
        if (exists) return prev;
        const { day, startTime, weekOffset: _wo, occurrenceId: _occ, ...base } = completed;
        return [...prev, base];
      });
    }

    // Clear strike-through state for this task id
    setStruckThroughTasks(prev => {
      const newSet = new Set(prev);
      newSet.delete(taskId);
      return newSet;
    });
  };

  const handleDeleteCompletedTask = (taskId) => {
    // Permanently remove this task everywhere
    setCompletedTasks(prev => prev.filter(t => t.id !== taskId));
    setScheduledTasks(prev => prev.filter(t => t.id !== taskId));
    setTasks(prev => prev.filter(t => t.id !== taskId));
  };

  const handleClearAllCompleted = () => {
    // Permanently remove all completed tasks everywhere
    const completedIds = new Set(completedTasks.map(t => t.id));
    setTasks(prev => prev.filter(t => !completedIds.has(t.id)));
    setScheduledTasks(prev => prev.filter(t => !completedIds.has(t.id)));
    setCompletedTasks([]);
  };

  const handleCompleteFromEdit = () => {
    if (editingItem && !editingItem.id.toString().startsWith('m')) {
      // Complete task from edit modal
      const task = scheduledTasks.find(t => t.id === editingItem.id && t.weekOffset === weekOffset) ||
                   tasks.find(t => t.id === editingItem.id);
      if (task) {
        // Remove all scheduled instances for this id in current week (consistent with "complete both")
        setScheduledTasks(prev => prev.filter(t => !(t.id === editingItem.id && t.weekOffset === weekOffset)));
        const lastDate = getLastOccurrenceDateForTask(editingItem.id);
        setCompletedTasks(prev => {
          const exists = prev.some(t => t.id === editingItem.id);
          return exists ? prev : [...prev, { ...editingItem, completedAt: lastDate }];
        });
      }
      setEditingItem(null);
    }
  };

  const handleDeleteFromEdit = () => {
    if (editingItem) {
      if (editingItem.id.toString().startsWith('m')) {
        // Delete meeting
        if (editingItem.recurring) {
          setDeleteConfirm(editingItem);
        } else {
          setMeetings(prev => prev.filter(m => m.id !== editingItem.id));
          setEditingItem(null);
        }
      } else {
        if (editingItem.occurrenceId) {
          // Delete only this scheduled occurrence
          setScheduledTasks(prev => prev.filter(t => t.occurrenceId !== editingItem.occurrenceId));
        } else {
          // Delete task everywhere
          setTasks(prev => prev.filter(t => t.id !== editingItem.id));
          setScheduledTasks(prev => prev.filter(t => t.id !== editingItem.id));
          setCompletedTasks(prev => prev.filter(t => t.id !== editingItem.id));
        }
        setEditingItem(null);
      }
    }
  };

  const handleEditItem = (item) => {
    setEditingItem(item);
  };

  const handleSaveEdit = () => {
    if (editingItem) {
      if (editingItem.id.toString().startsWith('m')) {
        // Editing a meeting
        setMeetings(prev => prev.map(m => 
          m.id === editingItem.id ? { ...m, ...editingItem } : m
        ));
      } else {
        // Editing a task
        if (editingItem.isNewRightClickTask) {
          // This is a new right-click task, add it to scheduled tasks with proper color mapping
          const { isNewRightClickTask, ...taskData } = editingItem;
          const taskWithColor = {
            ...taskData,
            color: getColorForTask(taskData.name),
            occurrenceId: createOccurrenceId(String(taskData.id))
          };
          setScheduledTasks(prev => [...prev, taskWithColor]);
        } else {
          // This is an existing task, update shared fields globally, avoid moving other instances
          setTasks(prev => prev.map(t =>
            t.id === editingItem.id
              ? { ...t, name: editingItem.name, notes: editingItem.notes || '', color: editingItem.color, duration: editingItem.duration }
              : t
          ));
          setScheduledTasks(prev => prev.map(t => {
            if (t.id !== editingItem.id) return t;
            const updated = { ...t, name: editingItem.name, notes: editingItem.notes || '', color: editingItem.color };
            // If editing a scheduled occurrence, apply duration only to that occurrence
            if (editingItem.occurrenceId && t.occurrenceId === editingItem.occurrenceId) {
              updated.duration = editingItem.duration;
            }
            return updated;
          }));
        }
      }
      setEditingItem(null);
    }
  };

  const handleAddTask = () => {
    if (newTask.name && newTask.duration > 0) {
      const task = {
        id: Date.now(),
        name: newTask.name,
        duration: newTask.duration,
        notes: newTask.notes || '',
        color: getColorForTask(newTask.name)
      };
      setTasks(prev => [...prev, task]);
      setNewTask({ name: '', duration: 30, notes: '' });
      setShowTaskModal(false);
    }
  };

  const handleAddMeeting = () => {
    if (newMeeting.name && newMeeting.duration > 0) {
      const meeting = {
        id: `m${Date.now()}`,
        ...newMeeting,
        weekOffset,
        color: '#374151'
      };
      
      if (newMeeting.recurring) {
        meeting.seriesId = `series${Date.now()}`;
      }
      
      setMeetings(prev => [...prev, meeting]);
      setNewMeeting({ name: '', day: 0, startTime: 9, duration: 60, notes: '', recurring: false });
      setShowMeetingModal(false);
      setQuickMeetingPos(null);
    }
  };

  const handleDeleteMeeting = (meeting, deleteAll = false) => {
    if (meeting.recurring && !deleteAll) {
      // Cancel just this instance
      setCancelledInstances(prev => new Set([...prev, meeting.instanceKey]));
    } else if (meeting.recurring && deleteAll) {
      // Delete the entire series
      setMeetings(prev => prev.filter(m => 
        !(m.seriesId && m.seriesId === meeting.seriesId)
      ));
      // Clear cancelled instances for this series
      setCancelledInstances(prev => {
        const newSet = new Set(prev);
        Array.from(newSet).forEach(key => {
          if (key.startsWith(meeting.seriesId)) {
            newSet.delete(key);
          }
        });
        return newSet;
      });
    } else {
      // Delete non-recurring meeting
      setMeetings(prev => prev.filter(m => m.id !== meeting.id));
    }
    setDeleteConfirm(null);
  };

  const handleKeyPress = (e, action) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      action();
    }
  };

  // Fill tasks starting from current time
  const handleFillTasks = () => {
    const unscheduledTasks = tasks.filter(task => 
      !scheduledTasks.find(st => st.id === task.id) && 
      !completedTasks.find(ct => ct.id === task.id)
    );

    if (unscheduledTasks.length === 0) return;

    // Get current time and day
    const now = currentTime;
    const currentDay = now.getDay() - 1; // 0 = Monday
    const currentHour = now.getHours() + now.getMinutes() / 60;
    
    // Only fill for current week
    if (weekOffset !== 0) return;

    // Get all existing scheduled items for the current week
    const existingItems = [
      ...scheduledTasks.filter(t => t.weekOffset === weekOffset),
      ...getVisibleMeetings()
    ];

    // Create time slots (15-minute intervals from 9 AM to 5 PM)
    const timeSlots = [];
    for (let day = Math.max(0, currentDay); day < 5; day++) {
      const startHour = day === currentDay ? Math.max(9, currentHour) : 9;
      for (let hour = startHour; hour < 17; hour += 0.25) {
        timeSlots.push({ day, time: hour });
      }
    }

    // Function to check if a time slot is available
    const isSlotAvailable = (day, startTime, duration) => {
      const endTime = startTime + duration / 60;
      
      return !existingItems.some(item => {
        if (item.day !== day) return false;
        const itemEnd = item.startTime + item.duration / 60;
        return (startTime < itemEnd && endTime > item.startTime);
      });
    };

    // Schedule tasks one by one
    const newScheduledTasks = [];
    
    for (const task of unscheduledTasks) {
      let scheduled = false;
      
      // Find the first available slot that fits this task
      for (const slot of timeSlots) {
        const durationInHours = task.duration / 60;
        
        // Check if task fits in this slot and doesn't conflict
        if (slot.time + durationInHours <= 17 && 
            isSlotAvailable(slot.day, slot.time, task.duration)) {
          
          const scheduledTask = {
            ...task,
            day: slot.day,
            startTime: slot.time,
            weekOffset,
            occurrenceId: createOccurrenceId(String(task.id))
          };
          
          newScheduledTasks.push(scheduledTask);
          existingItems.push(scheduledTask); // Add to existing items to avoid conflicts
          scheduled = true;
          break;
        }
      }
      
      if (!scheduled) {
        console.log(`Could not schedule task: ${task.name}`);
      }
    }

    // Update scheduled tasks
    if (newScheduledTasks.length > 0) {
      setScheduledTasks(prev => [...prev, ...newScheduledTasks]);
    }
  };

  // Task reordering handlers
  const handleTaskDragOver = (e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleTaskDrop = (e, dropIndex) => {
    e.preventDefault();
    if (draggedTaskIndex === null) return;

    const unscheduledTasks = tasks.filter(task => 
      !scheduledTasks.find(st => st.id === task.id) && 
      !completedTasks.find(ct => ct.id === task.id)
    );

    if (draggedTaskIndex === dropIndex) {
      setDraggedTaskIndex(null);
      return;
    }

    const draggedTask = unscheduledTasks[draggedTaskIndex];
    const newTasks = [...tasks];
    
    // Find the actual indices in the full tasks array
    const draggedTaskId = draggedTask.id;
    const dropTaskId = unscheduledTasks[dropIndex].id;
    
    const draggedIndex = newTasks.findIndex(t => t.id === draggedTaskId);
    const dropIndexInFull = newTasks.findIndex(t => t.id === dropTaskId);
    
    // Remove dragged task and insert at new position
    const [removed] = newTasks.splice(draggedIndex, 1);
    newTasks.splice(dropIndexInFull, 0, removed);
    
    setTasks(newTasks);
    setDraggedTaskIndex(null);
  };

  const currentTimePos = getCurrentTimePosition();

  // Day view navigation
  const handleDayNavigation = (direction) => {
    if (direction === 'prev') {
      if (selectedDay > 0) {
        setSelectedDay(selectedDay - 1);
      } else {
        setWeekOffset(weekOffset - 1);
        setSelectedDay(4);
      }
    } else {
      if (selectedDay < 4) {
        setSelectedDay(selectedDay + 1);
      } else {
        setWeekOffset(weekOffset + 1);
        setSelectedDay(0);
      }
    }
  };

  const getCurrentDate = () => {
    if (viewMode === 'day') {
      return weekDates[selectedDay];
    }
    return null;
  };

  const currentDate = getCurrentDate();

  // Utility function to get first word from task name for color mapping
  const getFirstWord = (taskName) => {
    return taskName.trim().toLowerCase().split(' ')[0] || 'default';
  };

  // Function to get color for task based on first word
  const getColorForTask = (taskName) => {
    const firstWord = getFirstWord(taskName);
    const colors = ['#3B82F6', '#10B981', '#F59E0B', '#8B5CF6', '#EC4899', '#EF4444', '#6B7280', '#14B8A6', '#F97316', '#84CC16'];
    
    // Check if we already have a color for this first word
    if (colorMap[firstWord]) {
      return colorMap[firstWord];
    }
    
    // Assign a new color and update the color map
    const newColor = colors[Object.keys(colorMap).length % colors.length];
    setColorMap(prev => ({ ...prev, [firstWord]: newColor }));
    return newColor;
  };

  // Helper: Monday date for a given week offset (relative to current week)
  const getMondayForOffset = useCallback((offset) => {
    const today = new Date();
    const monday = new Date(today);
    monday.setDate(today.getDate() - today.getDay() + 1 + (offset * 7));
    monday.setHours(0, 0, 0, 0);
    return monday;
  }, []);

  // Helper: Determine the last occurrence date for a task id across all scheduled instances
  const getLastOccurrenceDateForTask = useCallback((taskId) => {
    const occ = scheduledTasks.filter(t => t.id === taskId);
    if (occ.length === 0) return new Date();
    const last = occ.reduce((a, b) => {
      if ((a.weekOffset || 0) !== (b.weekOffset || 0)) return (a.weekOffset || 0) > (b.weekOffset || 0) ? a : b;
      if ((a.day || 0) !== (b.day || 0)) return (a.day || 0) > (b.day || 0) ? a : b;
      return (a.startTime || 0) >= (b.startTime || 0) ? a : b;
    });
    const monday = getMondayForOffset(last.weekOffset || 0);
    const date = new Date(monday);
    date.setDate(monday.getDate() + (last.day || 0));
    // Set to noon to avoid timezone boundary issues
    date.setHours(12, 0, 0, 0);
    return date;
  }, [scheduledTasks, getMondayForOffset]);

  // Compute daily completion counts for the displayed week
  const getDailyCompletionCounts = useCallback(() => {
    const counts = [0, 0, 0, 0, 0];
    if (!completedTasks || completedTasks.length === 0) return counts;
    for (let i = 0; i < 5; i++) {
      const start = new Date(weekDates[i]);
      start.setHours(0, 0, 0, 0);
      const end = new Date(start);
      end.setDate(start.getDate() + 1);
      counts[i] = completedTasks.reduce((acc, t) => {
        const ts = t.completedAt ? new Date(t.completedAt) : null;
        if (ts && ts >= start && ts < end) {
          return acc + 1;
        }
        return acc;
      }, 0);
    }
    return counts;
  }, [completedTasks, weekDates]);

  const dailyCompletionCounts = getDailyCompletionCounts();

  return (
    <div className={`h-screen bg-gray-50 ${isMobile ? 'p-2' : 'p-4'} flex flex-col`}>
      <div className="w-full mx-auto flex-1 flex flex-col min-h-0">
        
        {/* Status Bar */}
        <div className="bg-white rounded-lg shadow-md p-4 mb-4">
          <div className="flex justify-between items-start">
            {/* Mobile hamburger menu */}
            {isMobile && (
              <button
                onClick={() => setSidebarOpen(!sidebarOpen)}
                className="p-2 bg-gray-100 rounded-lg hover:bg-gray-200 mr-3 md:hidden"
              >
                <Menu className="w-5 h-5" />
              </button>
            )}
            
            <div className={`flex ${isMobile ? 'flex-col gap-2' : 'gap-4'} flex-1`}>
              <div 
                className={`bg-blue-50 rounded-lg p-3 ${isMobile ? 'w-full' : 'flex-1'} cursor-pointer hover:bg-blue-100 transition-colors`}
                onDoubleClick={() => {
                  if (currentTasks.length > 0) {
                    handleEditItem(currentTasks[0]);
                  }
                }}
              >
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <div className="text-sm text-blue-600 font-semibold mb-1">Current Task</div>
                    <div className={`${isMobile ? 'text-base' : 'text-lg'} font-bold text-blue-900`}>
                      {currentTasks.length === 0 ? 'No active task' : 
                       currentTasks.length === 1 ? currentTasks[0].name :
                       `${currentTasks[0].name} + ${currentTasks.length - 1} more`}
                    </div>
                    {timeRemaining && (
                      <div className="text-sm text-blue-600 mt-1 font-medium">
                        {timeRemaining} min remaining
                      </div>
                    )}
                  </div>
                  {!isMobile && currentTasks.length > 0 && currentTasks[0].notes && (
                    <div className="ml-3 text-xs text-blue-700 max-w-xs h-full flex items-start">
                      <div className="break-words whitespace-pre-wrap">{currentTasks[0].notes}</div>
                    </div>
                  )}
                </div>
              </div>
              
              {/* Hide next task on very small screens */}
              {(!isMobile || window.innerWidth > 480) && (
                <div 
                  className={`bg-green-50 rounded-lg p-3 ${isMobile ? 'w-full' : 'flex-1'} cursor-pointer hover:bg-green-100 transition-colors`}
                  onDoubleClick={() => {
                    if (nextTask) {
                      handleEditItem(nextTask);
                    }
                  }}
                >
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <div className="text-sm text-green-600 font-semibold mb-1">Next Task</div>
                      <div className={`${isMobile ? 'text-base' : 'text-lg'} font-bold text-green-900`}>
                        {nextTask ? `${nextTask.name} at ${formatTime(nextTask.startTime)}` : 'No upcoming task'}
                      </div>
                    </div>
                    {!isMobile && nextTask && nextTask.notes && (
                      <div className="ml-3 text-xs text-green-700 max-w-xs h-full flex items-start">
                        <div className="break-words whitespace-pre-wrap">{nextTask.notes}</div>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
            
            <div className={`flex ${isMobile ? 'flex-row gap-2' : 'flex-col gap-2'} ml-4`}>
              <button
                onClick={() => setChimeEnabled(!chimeEnabled)}
                className={`p-2 bg-white border-2 rounded-lg hover:bg-gray-50 flex items-center ${isMobile ? 'h-10 w-10' : 'h-8 w-8'} justify-center`}
                style={{
                  borderColor: chimeEnabled ? '#10B981' : '#6B7280'
                }}
                title={chimeEnabled ? 'Chime notifications enabled - click to disable' : 'Chime notifications disabled - click to enable'}
              >
                {chimeEnabled ? (
                  <Bell className={`${isMobile ? 'w-4 h-4' : 'w-3 h-3'} text-green-600`} />
                ) : (
                  <BellOff className={`${isMobile ? 'w-4 h-4' : 'w-3 h-3'} text-gray-500`} />
                )}
              </button>
              <button
                onClick={() => setShowDebugModal(true)}
                className={`p-2 bg-white border-2 rounded-lg hover:bg-gray-50 flex items-center ${isMobile ? 'h-10 w-10' : 'h-8 w-8'} justify-center`}
                style={{
                  borderColor: !isOnline ? '#EF4444' : 
                              saveStatus === 'saving' ? '#F59E0B' : 
                              saveStatus === 'saved' ? '#10B981' : '#EF4444'
                }}
                title="Debug Information"
              >
                <span className={`${isMobile ? 'text-sm' : 'text-xs'} font-bold`}>?</span>
              </button>
            </div>
          </div>
        </div>

        {/* Mobile Sidebar Overlay */}
        {isMobile && sidebarOpen && (
          <div 
            className="fixed inset-0 bg-black bg-opacity-50 z-40"
            onClick={() => setSidebarOpen(false)}
          />
        )}

        <div className={`${isMobile ? 'flex flex-col' : 'grid grid-cols-12 gap-6'} flex-1 min-h-0`}>
          {/* Left Sidebar - Unscheduled Tasks */}
          <div className={`${isMobile ? 
            `fixed inset-y-0 left-0 z-50 w-80 bg-white shadow-lg transform transition-transform duration-300 ease-in-out ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}` : 
            'col-span-3'
          } flex flex-col gap-4 min-h-0 ${isMobile ? 'pt-4' : ''}`}>
            <div 
              className="bg-white rounded-lg shadow-md p-4 flex-1 flex flex-col min-h-0"
              onDragOver={handleDragOver}
              onDrop={handleDropToUnscheduled}
            >
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-semibold text-gray-700">Tasks</h2>
                <div className="flex gap-2">
                  <button
                    onClick={handleFillTasks}
                    className="p-2 bg-green-500 text-white rounded-lg hover:bg-green-600"
                    title="Fill calendar with tasks starting from current time"
                  >
                    <Zap className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => setShowTaskModal(true)}
                    className="p-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600"
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                </div>
              </div>
              <div className="flex-1 overflow-y-auto space-y-2 min-h-[100px] pr-2"
                   onDragOver={handleTaskDragOver}
                   onDrop={handleDropToUnscheduled}
              >
                {tasks.filter(task => !scheduledTasks.find(st => st.id === task.id) && !completedTasks.find(ct => ct.id === task.id)).map((task, index) => (
                  <div
                    key={task.id}
                    draggable
                    onDragStart={(e) => {
                      // Set both drag types - let drop handlers determine which to use
                      setDraggedTaskIndex(index);
                      handleEnhancedDragStart(e, task, 'unscheduled');
                    }}
                    onDragOver={handleTaskDragOver}
                    onDrop={(e) => handleTaskDrop(e, index)}
                    onTouchStart={(e) => handleTouchStart(e, task, 'unscheduled')}
                    onTouchMove={(e) => handleTouchMove(e, task, 'unscheduled')}
                    onTouchEnd={(e) => handleTouchEnd(e, task, 'unscheduled')}
                    onDoubleClick={() => handleEditItem(task)}
                    className={`p-3 rounded-lg hover:shadow-lg transition-shadow cursor-move ${isMobile ? 'select-none touch-none' : ''}`}
                    style={{ 
                      backgroundColor: task.color + '20', 
                      borderLeft: `4px solid ${task.color}`,
                      ...(isMobile ? { 
                        userSelect: 'none', 
                        WebkitUserSelect: 'none',
                        touchAction: 'none',
                        WebkitTouchCallout: 'none'
                      } : {})
                    }}
                  >
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <div className="font-medium text-gray-800">{task.name}</div>
                        <div className="text-sm text-gray-600 flex items-center mt-1 gap-2">
                          <div className="flex items-center">
                            <Clock className="w-3 h-3 mr-1" />
                            {task.duration} min
                          </div>
                          {task.notes && (
                            <FileText className="w-3 h-3 text-gray-400" />
                          )}
                        </div>
                      </div>
                      <button
                        onClick={() => handleEditItem(task)}
                        className="p-1 hover:bg-gray-200 rounded"
                      >
                        <Edit2 className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Completed Tasks */}
            <div 
              className="bg-white rounded-lg shadow-md p-4 max-h-64 flex flex-col"
              onDragOver={handleDragOver}
              onDrop={handleDropToCompleted}
            >
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-semibold text-gray-700">Completed</h2>
                {completedTasks.length > 0 && (
                  <button
                    onClick={handleClearAllCompleted}
                    className="p-2 bg-red-500 text-white rounded-lg hover:bg-red-600"
                    title="Clear all completed tasks"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>
              <div className="flex-1 overflow-y-auto space-y-2">
                {completedTasks.map(task => (
                  <div
                    key={task.id}
                    className="p-3 rounded-lg opacity-60 hover:opacity-100 cursor-default"
                    style={{ backgroundColor: '#E5E7EB' }}
                  >
                    <div className="flex justify-between items-center">
                      <div>
                        <div className="font-medium text-gray-700 line-through">{task.name}</div>
                        <div className="text-sm text-gray-500">{task.duration} min</div>
                      </div>
                      <div className="flex items-center gap-1">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleUncompleteTask(task.id);
                          }}
                          className="p-1 hover:bg-blue-200 rounded text-blue-600 hover:text-blue-800"
                          title="Move back to Tasks"
                        >
                          <ArrowUp className="w-3 h-3" />
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteCompletedTask(task.id);
                          }}
                          className="p-1 hover:bg-red-200 rounded text-red-600 hover:text-red-800"
                          title="Delete permanently"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Calendar View */}
          <div className={`${isMobile ? 'flex-1' : 'col-span-9'} flex flex-col`}>
            <div className="bg-white rounded-lg shadow-md p-4 flex-1 flex flex-col">
              <div className={`flex ${isMobile ? 'flex-col gap-3' : 'justify-between items-center'} mb-2`}>
                <div className={`flex ${isMobile ? 'justify-between' : 'items-center gap-4'}`}>
                  <div className="flex items-center gap-2">
                    <div className="flex bg-gray-100 rounded-lg p-1">
                      <button
                        onClick={() => setViewMode('day')}
                        className={`${isMobile ? 'px-2 py-1' : 'px-3 py-1'} text-sm rounded ${viewMode === 'day' ? 'bg-white shadow-sm' : 'hover:bg-gray-200'}`}
                      >
                        <Eye className="w-4 h-4 inline mr-1" />
                        Day
                      </button>
                      {!isMobile && (
                        <button
                          onClick={() => setViewMode('week')}
                          className={`px-3 py-1 text-sm rounded ${viewMode === 'week' ? 'bg-white shadow-sm' : 'hover:bg-gray-200'}`}
                        >
                          <Calendar className="w-4 h-4 inline mr-1" />
                          Week
                        </button>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => viewMode === 'day' ? handleDayNavigation('prev') : setWeekOffset(prev => prev - 1)}
                      className={`${isMobile ? 'p-2' : 'p-1'} hover:bg-gray-100 rounded`}
                    >
                      <ChevronLeft className={`${isMobile ? 'w-6 h-6' : 'w-5 h-5'}`} />
                    </button>
                    <button
                      onClick={() => {
                        setWeekOffset(0);
                        if (viewMode === 'day') {
                          const today = new Date();
                          const currentDay = today.getDay() - 1; // 0 = Monday
                          setSelectedDay(Math.max(0, Math.min(4, currentDay)));
                        }
                      }}
                      className={`${isMobile ? 'px-4 py-2' : 'px-3 py-1'} text-sm bg-gray-100 rounded hover:bg-gray-200`}
                    >
                      Today
                    </button>
                    <button
                      onClick={() => viewMode === 'day' ? handleDayNavigation('next') : setWeekOffset(prev => prev + 1)}
                      className={`${isMobile ? 'p-2' : 'p-1'} hover:bg-gray-100 rounded`}
                    >
                      <ChevronRight className={`${isMobile ? 'w-6 h-6' : 'w-5 h-5'}`} />
                    </button>
                  </div>
                </div>
                
                {viewMode === 'day' && currentDate && (
                  <div className={`${isMobile ? 'text-center text-base' : 'text-lg'} font-medium text-gray-700`}>
                    {currentDate.toLocaleDateString('en-US', { 
                      weekday: 'long', 
                      month: 'long', 
                      day: 'numeric' 
                    })}{' '}
                    ({dailyCompletionCounts[selectedDay]}✓)
                  </div>
                )}
                
                <button
                  onClick={() => setShowMeetingModal(true)}
                  className={`${isMobile ? 'px-3 py-2 text-sm' : 'px-4 py-2'} bg-red-500 text-white rounded-lg hover:bg-red-600 flex items-center gap-2 ${isMobile ? 'self-end' : ''}`}
                >
                  <Calendar className="w-4 h-4" />
                  {isMobile ? 'Meeting' : 'Add Meeting'}
                </button>
              </div>
              <div className={`${isMobile ? 'text-xs' : 'text-xs'} text-gray-500 mb-2`}>
                {isMobile ? 'Tap to edit • Long press to drag • Swipe left/right to navigate days' : 'Double-click to add meeting • Drag to reschedule • Drag bottom edge to resize • Double-click to edit'}
              </div>
              
              <div 
                className="flex-1 overflow-auto"
                onTouchStart={handleSwipeStart}
                onTouchMove={handleSwipeMove}
                onTouchEnd={handleSwipeEnd}
              >
                <div className={`grid gap-1 ${isMobile && viewMode === 'day' ? '' : 'min-w-[800px]'} ${viewMode === 'day' ? 'grid-cols-[80px_1fr]' : 'grid-cols-[80px_repeat(5,1fr)]'}`}>
                  <div className="text-sm font-semibold text-gray-600 p-1 text-center sticky top-0 bg-white z-20">Time</div>
                  {viewMode === 'day' ? (
                    <div className="text-sm font-semibold text-gray-700 p-2 text-center sticky top-0 bg-white z-20">
                      <div>{dayNames[selectedDay]} ({dailyCompletionCounts[selectedDay]}✓)</div>
                      <div className="text-xs text-gray-500">
                        {weekDates[selectedDay].toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                      </div>
                    </div>
                  ) : (
                    dayNames.map((day, index) => (
                      <div key={day} className="text-sm font-semibold text-gray-700 p-2 text-center sticky top-0 bg-white z-20">
                        <div>{day} ({dailyCompletionCounts[index]}✓)</div>
                        <div className="text-xs text-gray-500">
                          {weekDates[index].toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                        </div>
                      </div>
                    ))
                  )}
                  
                  {(viewMode === 'day' ? hours : weekHours).map(hour => (
                    <React.Fragment key={hour}>
                      <div className="text-sm text-gray-600 p-2 border-t border-gray-200">
                        {hour === 12 ? '12 PM' : hour > 12 ? `${hour - 12} PM` : `${hour} AM`}
                      </div>
                      {(viewMode === 'day' ? [selectedDay] : [0, 1, 2, 3, 4]).map((dayIndex) => {
                        const dayItems = getOverlappingItems(dayIndex);
                        
                        return (
                          <div
                            key={`${hour}-${dayIndex}`}
                            data-calendar-cell
                            data-day={dayIndex}
                            data-hour={hour}
                            className={`border-t border-l border-gray-200 relative hover:bg-gray-50 ${isTimeSlotPast(dayIndex, hour) ? 'bg-gray-100' : ''}`}
                            style={{ 
                              height: `${pixelsPerHour}px`,
                              ...(isMobile ? { touchAction: 'pan-y', userSelect: 'none', WebkitUserSelect: 'none' } : {})
                            }}
                            onDragOver={handleDragOver}
                            onDrop={(e) => handleEnhancedDrop(e, dayIndex, hour)}
                            onDoubleClick={(e) => handleDoubleClickCalendar(e, dayIndex, hour)}
                            onContextMenu={(e) => handleRightClickCalendar(e, dayIndex, hour)}
                          >
                            {/* 15-minute grid lines */}
                            <div className="absolute inset-0 pointer-events-none">
                              <div className="border-t border-gray-100 absolute w-full" style={{ top: `${pixelsPerHour / 4}px` }}></div>
                              <div className="border-t border-gray-100 absolute w-full" style={{ top: `${pixelsPerHour / 2}px` }}></div>
                              <div className="border-t border-gray-100 absolute w-full" style={{ top: `${3 * pixelsPerHour / 4}px` }}></div>
                            </div>
                            
                            {/* Current time line */}
                            {currentTimePos && currentTimePos.day === dayIndex && hour === Math.floor(currentTime.getHours()) && (
                              <div 
                                className="absolute left-0 right-0 border-t-2 border-blue-500 z-30 pointer-events-none"
                                style={{ 
                                  top: `${(currentTime.getMinutes() / 60) * pixelsPerHour}px`
                                }}
                              >
                                <div className="absolute -left-1 -top-1 w-2 h-2 bg-blue-500 rounded-full"></div>
                              </div>
                            )}
                            
                            {/* Meetings and Tasks */}
                            {dayItems
                              .filter(item => {
                                const itemHour = Math.floor(item.startTime);
                                return itemHour === hour;
                              })
                              .map(item => {
                                const isMeeting = item.id.toString().startsWith('m');
                                const minuteOffset = (item.startTime - Math.floor(item.startTime)) * pixelsPerHour;
                                const width = item.totalColumns ? `${100 / item.totalColumns}%` : '100%';
                                const left = item.column ? `${(100 / item.totalColumns) * item.column}%` : '0';
                                const minHeight = (item.duration / 60) * pixelsPerHour; // Use actual duration height
                                
                                return (
                                  <div
                                    key={`${item.occurrenceId || item.id}-${item.instanceKey || ''}`}
                                    draggable
                                    onDragStart={(e) => handleEnhancedDragStart(e, item, isMeeting ? 'meeting' : 'scheduled')}
                                    onTouchStart={(e) => handleTouchStart(e, item, isMeeting ? 'meeting' : 'scheduled')}
                                    onTouchMove={(e) => handleTouchMove(e, item, isMeeting ? 'meeting' : 'scheduled')}
                                    onTouchEnd={(e) => handleTouchEnd(e, item, isMeeting ? 'meeting' : 'scheduled')}
                                    onDoubleClick={(e) => {
                                      e.stopPropagation();
                                      handleEditItem(item);
                                    }}
                                    className={`absolute p-1 cursor-move group overflow-hidden rounded ${isMobile ? 'select-none touch-none' : ''}`}
                                    style={{
                                      top: `${minuteOffset}px`,
                                      left,
                                      width,
                                      height: `${minHeight}px`,
                                      backgroundColor: item.color + 'DD',
                                      zIndex: 50 + (item.column || 0),
                                      ...(isMobile ? {
                                        userSelect: 'none',
                                        WebkitUserSelect: 'none',
                                        touchAction: 'none',
                                        WebkitTouchCallout: 'none'
                                      } : {})
                                    }}
                                  >
                                    <div className="text-white text-xs font-semibold h-full relative flex flex-col">
                                      {/* Task content - full width */}
                                      <div className="flex-1 overflow-hidden">
                                        <div className={`break-words leading-tight ${struckThroughTasks.has(item.id) ? 'line-through' : ''}`}>
                                          {item.name}
                                          {item.recurring && (
                                            <Repeat className="w-3 h-3 inline ml-1" />
                                          )}
                                        </div>
                                        <div className="text-xs opacity-75 mt-1">
                                          {item.duration} min
                                        </div>
                                        {item.notes && (
                                          <FileText className="w-3 h-3 mt-1 opacity-70" />
                                        )}
                                      </div>
                                      
                                      {/* Floating action buttons - overlay on top right */}
                                      <div className="absolute top-1 right-1 flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity bg-black bg-opacity-50 rounded p-0.5">
                                        {!isMeeting && (
                                          <>
                                            <button
                                              onClick={(e) => {
                                                e.stopPropagation();
                                                handleCompleteTask(item.id);
                                              }}
                                              className="p-0.5 hover:bg-white hover:bg-opacity-20 rounded"
                                              title="Move to Completed"
                                            >
                                              <ArrowDown className="w-3 h-3" />
                                            </button>
                                            <button
                                              onClick={(e) => {
                                                e.stopPropagation();
                                                handleUnscheduleTask(item.id, item.occurrenceId);
                                              }}
                                              className="p-0.5 hover:bg-white hover:bg-opacity-20 rounded"
                                              title="Move back to Tasks"
                                            >
                                              <ArrowUp className="w-3 h-3" />
                                            </button>
                                            <button
                                              onClick={(e) => {
                                                e.stopPropagation();
                                                handleStrikeThroughTask(item.id);
                                              }}
                                              className="p-0.5 hover:bg-white hover:bg-opacity-20 rounded"
                                              title="Strike through and add to Completed"
                                            >
                                              <Check className="w-3 h-3" />
                                            </button>
                                            <button
                                              onClick={(e) => {
                                                e.stopPropagation();
                                                handleDeleteOccurrence(item.id, item.occurrenceId);
                                              }}
                                              className="p-0.5 hover:bg-white hover:bg-opacity-20 rounded"
                                              title="Delete permanently"
                                            >
                                              <X className="w-3 h-3" />
                                            </button>
                                          </>
                                        )}
                                        {isMeeting && (
                                          <button
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              if (item.recurring) {
                                                setDeleteConfirm(item);
                                              } else {
                                                handleDeleteMeeting(item);
                                              }
                                            }}
                                            className="p-0.5 hover:bg-white hover:bg-opacity-20 rounded"
                                            title="Delete meeting"
                                          >
                                            <X className="w-3 h-3" />
                                          </button>
                                        )}
                                      </div>
                                      {/* Resize handle */}
                                      <div
                                        className="absolute bottom-0 left-0 right-0 h-2 cursor-ns-resize hover:bg-white hover:bg-opacity-20 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                                        onMouseDown={(e) => handleResizeStart(e, item, isMeeting ? 'meeting' : 'task')}
                                      >
                                        <GripVertical className="w-3 h-2" />
                                      </div>
                                    </div>
                                  </div>
                                );
                              })}
                          </div>
                        );
                      })}
                    </React.Fragment>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>


        {/* Delete Confirmation Dialog */}
        {deleteConfirm && (
          <div 
            className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[100]"
            onClick={(e) => {
              if (e.target === e.currentTarget) {
                setDeleteConfirm(null);
              }
            }}
          >
            <div className="bg-white rounded-lg p-6 w-96">
              <h3 className="text-xl font-semibold mb-4">Delete Recurring Meeting</h3>
              <p className="mb-4">This is a recurring meeting. What would you like to delete?</p>
              <div className="flex flex-col gap-2">
                <button
                  onClick={() => handleDeleteMeeting(deleteConfirm, false)}
                  className="w-full px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded text-left"
                >
                  Delete this occurrence only
                </button>
                <button
                  onClick={() => handleDeleteMeeting(deleteConfirm, true)}
                  className="w-full px-4 py-2 bg-red-100 hover:bg-red-200 rounded text-left"
                >
                  Delete entire series
                </button>
                <button
                  onClick={() => setDeleteConfirm(null)}
                  className="w-full px-4 py-2 text-gray-600 hover:bg-gray-100 rounded"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Edit Item Modal */}
        {editingItem && (
          <div 
            className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[100]"
            onClick={(e) => {
              if (e.target === e.currentTarget) {
                setEditingItem(null);
              }
            }}
          >
            <div className="bg-white rounded-lg p-6 w-96 max-h-[80vh] overflow-y-auto">
              <h3 className="text-xl font-semibold mb-4">
                Edit {editingItem.id.toString().startsWith('m') ? 'Meeting' : 'Task'}
              </h3>
              <input
                type="text"
                value={editingItem.name}
                onChange={(e) => setEditingItem({ ...editingItem, name: e.target.value })}
                onKeyPress={(e) => handleKeyPress(e, handleSaveEdit)}
                className="w-full p-2 border rounded mb-4"
                placeholder="Name"
                autoFocus
              />
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Duration: {editingItem.duration} minutes
              </label>
              <input
                type="range"
                min="15"
                max="240"
                step="15"
                value={editingItem.duration}
                onChange={(e) => setEditingItem({ ...editingItem, duration: parseInt(e.target.value) })}
                className="w-full mb-4"
              />
              <label className="block text-sm font-medium text-gray-700 mb-2">Notes</label>
              <textarea
                value={editingItem.notes || ''}
                onChange={(e) => setEditingItem({ ...editingItem, notes: e.target.value })}
                className="w-full p-2 border rounded mb-4 h-24"
                placeholder="Add notes..."
              />
              {!editingItem.id.toString().startsWith('m') && (
                <>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Color</label>
                  <div className="flex gap-2 mb-4">
                    {['#3B82F6', '#10B981', '#F59E0B', '#8B5CF6', '#EC4899', '#EF4444', '#6B7280', '#14B8A6'].map(color => (
                      <button
                        key={color}
                        onClick={() => setEditingItem({ ...editingItem, color })}
                        className={`w-8 h-8 rounded-full border-2 ${editingItem.color === color ? 'border-gray-800' : 'border-gray-300'}`}
                        style={{ backgroundColor: color }}
                        title={`Select ${color}`}
                      />
                    ))}
                  </div>
                </>
              )}
              <div className="flex justify-between">
                <div className="flex gap-2">
                  {!editingItem.id.toString().startsWith('m') && (
                    <button
                      onClick={handleCompleteFromEdit}
                      className="p-2 bg-green-500 text-white rounded hover:bg-green-600"
                      title="Complete"
                    >
                      <Check className="w-4 h-4" />
                    </button>
                  )}
                  <button
                    onClick={handleDeleteFromEdit}
                    className="p-2 bg-red-500 text-white rounded hover:bg-red-600"
                    title="Delete"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => setEditingItem(null)}
                    className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleSaveEdit}
                    className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
                  >
                    Save
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Add Task Modal */}
        {showTaskModal && (
          <div 
            className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[100]"
            onClick={(e) => {
              if (e.target === e.currentTarget) {
                setShowTaskModal(false);
              }
            }}
          >
            <div className="bg-white rounded-lg p-6 w-96">
              <h3 className="text-xl font-semibold mb-4">Add New Task</h3>
              <input
                type="text"
                value={newTask.name}
                onChange={(e) => setNewTask({ ...newTask, name: e.target.value })}
                onKeyPress={(e) => handleKeyPress(e, handleAddTask)}
                className="w-full p-2 border rounded mb-4"
                placeholder="Task name"
                autoFocus
              />
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Duration: {newTask.duration} minutes
              </label>
              <input
                type="range"
                min="15"
                max="240"
                step="15"
                value={newTask.duration}
                onChange={(e) => setNewTask({ ...newTask, duration: parseInt(e.target.value) })}
                className="w-full mb-4"
              />
              <label className="block text-sm font-medium text-gray-700 mb-2">Notes</label>
              <textarea
                value={newTask.notes}
                onChange={(e) => setNewTask({ ...newTask, notes: e.target.value })}
                className="w-full p-2 border rounded mb-4 h-24"
                placeholder="Add notes..."
              />
              <div className="flex justify-end gap-2">
                <button
                  onClick={() => setShowTaskModal(false)}
                  className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded"
                >
                  Cancel
                </button>
                <button
                  onClick={handleAddTask}
                  className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
                >
                  Add Task
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Add Meeting Modal */}
        {showMeetingModal && (
          <div 
            className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[100]"
            onClick={(e) => {
              if (e.target === e.currentTarget) {
                setShowMeetingModal(false);
                setQuickMeetingPos(null);
              }
            }}
          >
            <div className="bg-white rounded-lg p-6 w-96 max-h-[80vh] overflow-y-auto">
              <h3 className="text-xl font-semibold mb-4">
                {quickMeetingPos ? `Add Meeting at ${formatTime(quickMeetingPos.startTime)} on ${dayNames[quickMeetingPos.day]}` : 'Add New Meeting'}
              </h3>
              <input
                type="text"
                value={newMeeting.name}
                onChange={(e) => setNewMeeting({ ...newMeeting, name: e.target.value })}
                onKeyPress={(e) => handleKeyPress(e, handleAddMeeting)}
                className="w-full p-2 border rounded mb-4"
                placeholder="Meeting name"
                autoFocus
              />
              {!quickMeetingPos && (
                <>
                  <select
                    value={newMeeting.day}
                    onChange={(e) => setNewMeeting({ ...newMeeting, day: parseInt(e.target.value) })}
                    className="w-full p-2 border rounded mb-4"
                  >
                    {dayNames.map((day, index) => (
                      <option key={index} value={index}>{day}</option>
                    ))}
                  </select>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Start Time: {formatTime(newMeeting.startTime)}
                  </label>
                  <input
                    type="range"
                    min="6"
                    max="19.75"
                    step="0.25"
                    value={newMeeting.startTime}
                    onChange={(e) => setNewMeeting({ ...newMeeting, startTime: parseFloat(e.target.value) })}
                    className="w-full mb-4"
                  />
                </>
              )}
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Duration: {newMeeting.duration} minutes
              </label>
              <input
                type="range"
                min="15"
                max="240"
                step="15"
                value={newMeeting.duration}
                onChange={(e) => setNewMeeting({ ...newMeeting, duration: parseInt(e.target.value) })}
                className="w-full mb-4"
              />
              <label className="block text-sm font-medium text-gray-700 mb-2">Notes</label>
              <textarea
                value={newMeeting.notes}
                onChange={(e) => setNewMeeting({ ...newMeeting, notes: e.target.value })}
                className="w-full p-2 border rounded mb-4 h-24"
                placeholder="Add notes..."
              />
              <div className="flex items-center mb-4">
                <input
                  type="checkbox"
                  id="recurring"
                  checked={newMeeting.recurring}
                  onChange={(e) => setNewMeeting({ ...newMeeting, recurring: e.target.checked })}
                  className="mr-2"
                />
                <label htmlFor="recurring" className="text-sm font-medium text-gray-700">
                  Recurring weekly
                </label>
              </div>
              <div className="flex justify-end gap-2">
                <button
                  onClick={() => {
                    setShowMeetingModal(false);
                    setQuickMeetingPos(null);
                  }}
                  className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded"
                >
                  Cancel
                </button>
                <button
                  onClick={handleAddMeeting}
                  className="px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600"
                >
                  Add Meeting
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Debug Modal */}
        {showDebugModal && (
          <div 
            className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[100]"
            onClick={(e) => {
              if (e.target === e.currentTarget) {
                setShowDebugModal(false);
              }
            }}
          >
            <div className="bg-white rounded-lg p-6 w-96 max-h-[80vh] overflow-y-auto">
              <h3 className="text-xl font-semibold mb-4">Debug Information</h3>
              <div className="space-y-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700">Calendar ID:</label>
                  <div className="mt-1 p-2 bg-gray-100 rounded break-all text-sm">{calendarId || 'Not set'}</div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Last Modified:</label>
                  <div className="mt-1 p-2 bg-gray-100 rounded break-all text-sm">
                    {lastSaved ? new Date(lastSaved).toLocaleString() : 'Not available'}
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Connection Status:</label>
                  <div className="mt-1 p-2 bg-gray-100 rounded text-sm">
                    <span className={`inline-block w-3 h-3 rounded-full mr-2 ${isOnline ? 'bg-green-500' : 'bg-red-500'}`}></span>
                    {isOnline ? 'Online' : 'Offline'}
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Save Status:</label>
                  <div className="mt-1 p-2 bg-gray-100 rounded text-sm">
                    {saveStatus === 'saving' && (
                      <span className="text-yellow-600">Saving...</span>
                    )}
                    {saveStatus === 'saved' && (
                      <span className="text-green-600">Saved</span>
                    )}
                    {saveStatus === 'error' && (
                      <span className="text-red-600">Error</span>
                    )}
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Task Counts:</label>
                  <div className="mt-1 p-2 bg-gray-100 rounded text-sm">
                    <div>Tasks: {tasks.length}</div>
                    <div>Meetings: {meetings.length}</div>
                    <div>Scheduled: {scheduledTasks.length}</div>
                    <div>Completed: {completedTasks.length}</div>
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Calendar Share URL:</label>
                  <div className="mt-1 p-2 bg-gray-100 rounded break-all text-sm">
                    {`${window.location.origin}${window.location.pathname}?id=${calendarId || '001'}`}
                  </div>
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(`${window.location.origin}${window.location.pathname}?id=${calendarId || '001'}`);
                    }}
                    className="mt-2 px-3 py-1 bg-blue-500 text-white text-xs rounded hover:bg-blue-600"
                  >
                    Copy Share URL
                  </button>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Current URL:</label>
                  <div className="mt-1 p-2 bg-gray-100 rounded break-all text-sm">
                    {window.location.href}
                  </div>
                </div>
              </div>
              <div className="mt-6 flex justify-end">
                <button
                  onClick={() => setShowDebugModal(false)}
                  className="px-4 py-2 bg-gray-200 text-gray-800 rounded hover:bg-gray-300"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default TodoCalendarApp;
