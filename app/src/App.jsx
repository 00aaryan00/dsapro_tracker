import { useState, useEffect, useLayoutEffect, useRef } from 'react';
import confetti from 'canvas-confetti';
import courseData from './data.json';
import './index.css';

function App() {
  const [progress, setProgress] = useState(() => {
    const saved = localStorage.getItem('dsaTrackerProgress');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        console.error('Failed to parse saved progress', e);
        return {};
      }
    }
    return {};
  });
  
  const [expandedTopics, setExpandedTopics] = useState({});
  const [searchQuery, setSearchQuery] = useState('');
  const [hideCompleted, setHideCompleted] = useState(false);
  const [confidenceFilter, setConfidenceFilter] = useState('all'); // 'all', 'starred', 'low', 'med', 'high', 'unrated'
  const [darkMode, setDarkMode] = useState(() => {
    const saved = localStorage.getItem('dsaTrackerTheme');
    return saved === 'dark';
  });
  
  const fileInputRef = useRef(null);
  const prevCompletedRef = useRef(0);
  const prevTopicStatusRef = useRef({});
  const isFirstRender = useRef(true);

  const exportData = (dataToExport) => {
    // If it's called from a button click, it receives a React event. Ignore it.
    const actualData = (dataToExport && !dataToExport.nativeEvent) ? dataToExport : progress;
    const dataStr = JSON.stringify(actualData, null, 2);
    const dataUri = 'data:application/json;charset=utf-8,'+ encodeURIComponent(dataStr);
    
    const exportFileDefaultName = 'dsa_tracker_backup.json';
    
    const linkElement = document.createElement('a');
    linkElement.setAttribute('href', dataUri);
    linkElement.setAttribute('download', exportFileDefaultName);
    linkElement.click();
  };

  const triggerConfetti = () => {
    confetti({
      particleCount: 100,
      spread: 70,
      origin: { y: 0.6 }
    });
  };

  const scrollAnchorRef = useRef(null);

  const toggleHideCompleted = () => {
    // Find all session items
    const items = document.querySelectorAll('.session-item');
    let anchorNode = null;
    let anchorOffset = 0;
    
    // Find the first item that is currently in the viewport
    // Considering the sticky header is roughly 150-180px tall
    for (let item of items) {
      const rect = item.getBoundingClientRect();
      if (rect.top > 120 && rect.top < window.innerHeight) {
        anchorNode = item;
        anchorOffset = rect.top;
        break;
      }
    }

    if (anchorNode) {
      scrollAnchorRef.current = { id: anchorNode.id, offset: anchorOffset };
    } else {
      scrollAnchorRef.current = null;
    }

    setHideCompleted(prev => !prev);
  };

  // Restore scroll position after DOM update when toggling Hide Done
  useLayoutEffect(() => {
    if (scrollAnchorRef.current) {
      const { id, offset } = scrollAnchorRef.current;
      const anchorNode = document.getElementById(id);
      if (anchorNode) {
        const currentRect = anchorNode.getBoundingClientRect();
        // Calculate how much the anchor moved vertically
        const difference = currentRect.top - offset;
        window.scrollBy(0, difference);
      }
      scrollAnchorRef.current = null;
    }
  }, [hideCompleted]);

  const [tickCount, setTickCount] = useState(() => {
    const saved = localStorage.getItem('dsaTrackerTickCount');
    return saved ? parseInt(saved, 10) : 0;
  });

  // Apply dark mode theme
  useEffect(() => {
    if (darkMode) {
      document.documentElement.setAttribute('data-theme', 'dark');
      localStorage.setItem('dsaTrackerTheme', 'dark');
    } else {
      document.documentElement.removeAttribute('data-theme');
      localStorage.setItem('dsaTrackerTheme', 'light');
    }
  }, [darkMode]);

  // Save to local storage whenever progress changes
  useEffect(() => {
    if (Object.keys(progress).length > 0) {
       localStorage.setItem('dsaTrackerProgress', JSON.stringify(progress));
    } else {
       localStorage.setItem('dsaTrackerProgress', JSON.stringify(progress));
    }
  }, [progress]);

  // Save tick count to local storage
  useEffect(() => {
    localStorage.setItem('dsaTrackerTickCount', tickCount.toString());
  }, [tickCount]);

  // Backup Reminder Effect
  useEffect(() => {
    if (tickCount > 0 && tickCount % 5 === 0) {
      setTimeout(() => {
        const shouldBackup = window.confirm(`Great job, you've checked off 5 sessions! It's a good time to backup your data. Would you like to download a backup now?`);
        if (shouldBackup) {
          // Pull fresh from localStorage to guarantee we get the latest state
          const latestDataStr = localStorage.getItem('dsaTrackerProgress');
          const dataToExport = latestDataStr ? JSON.parse(latestDataStr) : progress;
          exportData(dataToExport);
        }
      }, 500);
    }
  }, [tickCount]);

  const toggleSession = (id) => {
    const isCurrentlyCompleted = progress[id]?.completed || false;
    const isNowCompleted = !isCurrentlyCompleted;

    // Update progress state
    setProgress(prev => ({
      ...prev,
      [id]: {
        ...prev[id],
        completed: isNowCompleted
      }
    }));

    if (isNowCompleted) {
      // Fire confetti immediately on every check!
      triggerConfetti();
      // Increment tick counter
      setTickCount(prev => prev + 1);
    } else {
      // Decrement if unchecked
      setTickCount(prev => Math.max(0, prev - 1));
    }
  };



  const setConfidence = (id, level) => {
    setProgress(prev => {
      const currentLevel = prev[id]?.confidence;
      return {
        ...prev,
        [id]: {
          ...prev[id],
          confidence: currentLevel === level ? null : level
        }
      };
    });
  };

  const toggleStar = (id) => {
    setProgress(prev => ({
      ...prev,
      [id]: {
        ...prev[id],
        starred: !prev[id]?.starred
      }
    }));
  };

  const setNotes = (id, text) => {
    setProgress(prev => ({
      ...prev,
      [id]: {
        ...prev[id],
        notes: text
      }
    }));
  };

  const toggleTopic = (topicName) => {
    setExpandedTopics(prev => ({
      ...prev,
      [topicName]: !prev[topicName]
    }));
  };

  const expandAll = () => {
    const allExpanded = {};
    courseData.forEach(topic => {
      allExpanded[topic.topic] = true;
    });
    setExpandedTopics(allExpanded);
  };

  const collapseAll = () => {
    setExpandedTopics({});
  };



  const importData = (event) => {
    const file = event.target.files[0];
    if (!file) return;
    
    // Warn user before overwriting
    const confirmImport = window.confirm("Warning: Importing a backup will overwrite all your current progress. Are you sure you want to proceed?");
    if (!confirmImport) {
      event.target.value = ''; // Reset file input
      return;
    }
    
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = JSON.parse(e.target.result);
        setProgress(data);
        alert('Data imported successfully!');
      } catch (err) {
        alert('Invalid file format. Please upload a valid backup JSON.');
      }
    };
    reader.readAsText(file);
    
    // Reset file input
    event.target.value = '';
  };

  const triggerFileInput = () => {
    fileInputRef.current.click();
  };

  // Calculate overall stats
  let totalSessions = 0;
  let completedSessions = 0;

  courseData.forEach(topic => {
    topic.sessions.forEach(session => {
      totalSessions++;
      if (progress[session.id]?.completed) {
        completedSessions++;
      }
    });
  });

  const completionPercentage = totalSessions === 0 ? 0 : Math.round((completedSessions / totalSessions) * 100);

  // Filter topics based on search query and hide completed setting
  const filteredData = courseData.map(topic => {
    // Filter sessions
    const matchingSessions = topic.sessions.filter(session => {
      const sessionProgress = progress[session.id] || {};
      const matchesSearch = session.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
                            (session.details && session.details.toLowerCase().includes(searchQuery.toLowerCase()));
      const isCompleted = sessionProgress.completed;
      const matchesVisibility = hideCompleted ? !isCompleted : true;
      
      let matchesConfidence = true;
      if (confidenceFilter === 'starred') {
        matchesConfidence = !!sessionProgress.starred;
      } else if (confidenceFilter === 'unrated') {
        matchesConfidence = !sessionProgress.confidence;
      } else if (confidenceFilter !== 'all') {
        matchesConfidence = sessionProgress.confidence === confidenceFilter;
      }
      
      return matchesSearch && matchesVisibility && matchesConfidence;
    });
    
    // Also include topic if title matches search and we have sessions left to show
    const matchesTopicTitle = topic.topic.toLowerCase().includes(searchQuery.toLowerCase());
    
    // Only show empty topics (matching title) if we are not applying ANY session-specific filters
    const isSessionFiltered = hideCompleted || confidenceFilter !== 'all';
    
    if (matchingSessions.length > 0 || (matchesTopicTitle && !isSessionFiltered)) {
       const sessionsToShow = matchesTopicTitle && !isSessionFiltered ? 
          topic.sessions : 
          matchingSessions;
          
       if (sessionsToShow.length > 0) {
         return { ...topic, sessions: sessionsToShow };
       }
    }
    return null;
  }).filter(Boolean);

  return (
    <div className="app-container">
      <header className="header">
        <div className="header-top">
          <h1>851-Hour DSA + OA + CP Tracker</h1>
          <div className="header-actions">
            <button className="btn" onClick={() => setDarkMode(!darkMode)} title="Toggle Dark Mode">
              {darkMode ? '☀️ Light Mode' : '🌙 Dark Mode'}
            </button>
            <button 
              className={`btn ${hideCompleted ? 'btn-primary' : ''}`} 
              onClick={toggleHideCompleted}
              style={{ marginRight: '8px' }}
            >
              <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><path d="M12 4.5C7 4.5 2.73 7.61 1 12c1.73 4.39 6 7.5 11 7.5s9.27-3.11 11-7.5c-1.73-4.39-6-7.5-11-7.5zM12 17c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5zm0-8c-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3-1.34-3-3-3z"/></svg>
              {hideCompleted ? 'Show All' : 'Hide Done'}
            </button>
            <button className="btn" onClick={expandAll}>
              Expand All
            </button>
            <button className="btn" onClick={collapseAll}>
              Collapse All
            </button>
            <button className="btn" onClick={triggerFileInput}>
              <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><path d="M14 2H6c-1.1 0-1.99.9-1.99 2L4 20c0 1.1.89 2 1.99 2H18c1.1 0 2-.9 2-2V8l-6-6zm4 18H6V4h7v5h5v11zM8 15.01l1.41 1.41L11 14.83V19h2v-4.17l1.59 1.59L16 15.01 12.01 11 8 15.01z"/></svg>
              Import
            </button>
            <input 
              type="file" 
              accept=".json" 
              ref={fileInputRef} 
              onChange={importData} 
              className="file-input-hidden" 
            />
            <button className="btn btn-primary" onClick={exportData}>
              <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><path d="M19 9h-4V3H9v6H5l7 7 7-7zM5 18v2h14v-2H5z"/></svg>
              Export Backup
            </button>
          </div>
        </div>
        <div className="search-container">
          <input 
            type="text" 
            className="search-input" 
            placeholder="Search topics or sessions..." 
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          <select 
            className="filter-select"
            value={confidenceFilter}
            onChange={(e) => setConfidenceFilter(e.target.value)}
          >
            <option value="all">All Levels</option>
            <option value="starred">⭐ Starred</option>
            <option value="low">Low Confidence</option>
            <option value="med">Medium Confidence</option>
            <option value="high">High Confidence</option>
            <option value="unrated">Unrated</option>
          </select>
        </div>
      </header>

      <div className="stats-container">
        <div className="stat-card">
          <div className="stat-label">Overall Progress</div>
          <div className="stat-value">{completionPercentage}%</div>
          <div style={{ marginTop: '8px' }}>
            <div className="progress-bar-bg" style={{ width: '100%' }}>
              <div className="progress-bar-fill" style={{ width: `${completionPercentage}%` }}></div>
            </div>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Sessions Completed</div>
          <div className="stat-value">{completedSessions} / {totalSessions}</div>
        </div>
      </div>

      <div className="topics-list">
        {filteredData.map((topic, index) => {
          const topicSessions = topic.sessions.length;
          const topicCompleted = topic.sessions.filter(s => progress[s.id]?.completed).length;
          const topicPercentage = topicSessions === 0 ? 0 : Math.round((topicCompleted / topicSessions) * 100);
          const isExpanded = expandedTopics[topic.topic] || false;

          return (
            <div className="topic-card" key={index}>
              <div className="topic-header" onClick={() => toggleTopic(topic.topic)}>
                <div className="topic-title">{topic.topic}</div>
                <div className="topic-progress">
                  <span>{topicCompleted}/{topicSessions}</span>
                  <div className="progress-bar-bg">
                    <div className="progress-bar-fill" style={{ width: `${topicPercentage}%` }}></div>
                  </div>
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor" style={{ transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.2s' }}>
                    <path d="M7 10l5 5 5-5z"/>
                  </svg>
                </div>
              </div>
              
              {isExpanded && (
                <div className="session-list">
                  {topic.sessions.map(session => {
                    const sessionState = progress[session.id] || {};
                    const isCompleted = sessionState.completed || false;
                    
                    return (
                      <div className="session-item" id={`session-${session.id}`} key={session.id}>
                        <div className="checkbox-container">
                          <div 
                            className={`checkbox-custom ${isCompleted ? 'checked' : ''}`}
                            onClick={() => toggleSession(session.id)}
                          >
                            <svg viewBox="0 0 24 24"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/></svg>
                          </div>
                        </div>
                        <div className="session-content">
                          <div className="session-title-row">
                            <div className={`session-title ${isCompleted ? 'completed' : ''}`}>
                              {session.title}
                            </div>
                            <button 
                              className={`star-btn ${sessionState.starred ? 'starred' : ''}`}
                              onClick={() => toggleStar(session.id)}
                              title="Star this question"
                            >
                              <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
                                {sessionState.starred ? (
                                  <path d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z"/>
                                ) : (
                                  <path d="M22 9.24l-7.19-.62L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21 12 17.27 18.18 21l-1.63-7.03L22 9.24zM12 15.4l-3.76 2.27 1-4.28-3.32-2.88 4.38-.38L12 6.1l1.71 4.04 4.38.38-3.32 2.88 1 4.28L12 15.4z"/>
                                )}
                              </svg>
                            </button>
                          </div>
                          
                          {session.details && (
                            <div className="session-details">{session.details}</div>
                          )}
                          
                          {session.links && session.links.length > 0 && (
                            <div className="session-links">
                              {session.links.map((link, i) => (
                                <a 
                                  key={i} 
                                  href={link} 
                                  target="_blank" 
                                  rel="noreferrer" 
                                  className="session-link"
                                >
                                  Link {i + 1}
                                </a>
                              ))}
                            </div>
                          )}
                          
                          <div className="session-actions">
                            <div className="confidence-selector">
                              Confidence:
                              <button 
                                className={`confidence-btn ${sessionState.confidence === 'low' ? 'active-low' : ''}`}
                                onClick={() => setConfidence(session.id, 'low')}
                              >Low</button>
                              <button 
                                className={`confidence-btn ${sessionState.confidence === 'med' ? 'active-med' : ''}`}
                                onClick={() => setConfidence(session.id, 'med')}
                              >Medium</button>
                              <button 
                                className={`confidence-btn ${sessionState.confidence === 'high' ? 'active-high' : ''}`}
                                onClick={() => setConfidence(session.id, 'high')}
                              >High</button>
                            </div>
                          </div>
                          
                          <textarea 
                            className="notes-input" 
                            placeholder="Add personal notes here..."
                            value={sessionState.notes || ''}
                            onChange={(e) => setNotes(session.id, e.target.value)}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default App;
