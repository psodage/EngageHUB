import { useEffect, useState } from "react";
import { useApp } from "../../context/AppContext.jsx";
import { getClientApiBaseUrl } from "../../config/api.js";
import "./SharedCalendar.css";

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const STATUS_LIST = ["scheduled", "draft", "published", "failed"];

function platformAbbr(name) {
  return (name || "").slice(0, 2).toUpperCase();
}

function formatTime(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  const h = d.getHours();
  const m = d.getMinutes();
  const ampm = h >= 12 ? "PM" : "AM";
  const h12 = h % 12 || 12;
  return `${h12}:${String(m).padStart(2, "0")} ${ampm}`;
}

function truncateText(text, max = 40) {
  if (!text) return "";
  return text.length > max ? text.slice(0, max) + "..." : text;
}

export default function SharedCalendar() {
  const { isAuthed } = useApp();
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [draggedPost, setDraggedPost] = useState(null);
  const [dragOverDay, setDragOverDay] = useState(null);

  // ── Fetch posts on mount ────────────────────────
  useEffect(() => {
    const token = localStorage.getItem("engagehub-auth-token");
    if (!token) {
      setLoading(false);
      return;
    }

    const base = getClientApiBaseUrl();

    fetch(`${base}/api/posts`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((res) => res.json())
      .then((data) => {
        if (data.success) {
          setPosts(data.data?.posts || data.posts || []);
        }
      })
      .catch(() => {
        /* silent */
      })
      .finally(() => setLoading(false));
  }, [isAuthed]);

  // ── Date helpers ────────────────────────────────
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const today = new Date();
  const isToday = (day) =>
    day === today.getDate() &&
    month === today.getMonth() &&
    year === today.getFullYear();

  const monthLabel = currentDate.toLocaleString("default", {
    month: "long",
    year: "numeric",
  });

  // ── Month navigation ───────────────────────────
  const prevMonth = () =>
    setCurrentDate(new Date(year, month - 1, 1));
  const nextMonth = () =>
    setCurrentDate(new Date(year, month + 1, 1));

  // ── Posts for a given day ───────────────────────
  const postsForDay = (day) =>
    posts.filter((p) => {
      if (!p.scheduledAt) return false;
      const d = new Date(p.scheduledAt);
      return (
        d.getFullYear() === year &&
        d.getMonth() === month &&
        d.getDate() === day
      );
    });

  // ── Drag & Drop handlers ───────────────────────
  const handleDragStart = (post) => {
    setDraggedPost(post);
  };

  const handleDragOver = (e, day) => {
    e.preventDefault();
    setDragOverDay(day);
  };

  const handleDragLeave = () => {
    setDragOverDay(null);
  };

  const handleDrop = async (e, day) => {
    e.preventDefault();
    setDragOverDay(null);

    if (!draggedPost) return;

    const original = new Date(draggedPost.scheduledAt);
    const updated = new Date(
      year,
      month,
      day,
      original.getHours(),
      original.getMinutes(),
      original.getSeconds()
    );

    const newScheduledAt = updated.toISOString();
    const token = localStorage.getItem("engagehub-auth-token");
    const base = getClientApiBaseUrl();

    try {
      const res = await fetch(`${base}/api/posts/${draggedPost._id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ scheduledAt: newScheduledAt }),
      });

      if (res.ok) {
        setPosts((prev) =>
          prev.map((p) =>
            p._id === draggedPost._id
              ? { ...p, scheduledAt: newScheduledAt }
              : p
          )
        );
      }
    } catch {
      /* silent */
    }

    setDraggedPost(null);
  };

  // ── Delete handler ─────────────────────────────
  const handleDelete = async (postId) => {
    const token = localStorage.getItem("engagehub-auth-token");
    const base = getClientApiBaseUrl();

    try {
      const res = await fetch(`${base}/api/posts/${postId}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });

      if (res.ok) {
        setPosts((prev) => prev.filter((p) => p._id !== postId));
      }
    } catch {
      /* silent */
    }
  };

  // ── Loading state ──────────────────────────────
  if (loading) {
    return (
      <div className="calendar-container">
        <div className="calendar-loading">
          <span className="calendar-loading-spinner" />
          Loading schedule...
        </div>
      </div>
    );
  }

  // ── Render ─────────────────────────────────────
  return (
    <div className="calendar-container">
      {/* Toolbar: nav + legend */}
      <div className="calendar-toolbar">
        <div className="calendar-nav">
          <button
            type="button"
            className="nav-btn"
            onClick={prevMonth}
            aria-label="Previous month"
          >
            ←
          </button>
          <h2 className="calendar-title">{monthLabel}</h2>
          <button
            type="button"
            className="nav-btn"
            onClick={nextMonth}
            aria-label="Next month"
          >
            →
          </button>
        </div>

        <ul className="calendar-legend">
          {STATUS_LIST.map((s) => (
            <li key={s} className="legend-item">
              <span className={`legend-dot ${s}`} />
              {s}
            </li>
          ))}
        </ul>
      </div>

      {/* Grid */}
      <div className="calendar-grid">
        {/* Day-of-week headers */}
        {DAYS.map((d) => (
          <div key={d} className="calendar-day-header">
            {d}
          </div>
        ))}

        {/* Empty leading cells */}
        {Array.from({ length: firstDay }).map((_, i) => (
          <div key={`empty-${i}`} className="calendar-cell empty" />
        ))}

        {/* Day cells */}
        {Array.from({ length: daysInMonth }).map((_, i) => {
          const day = i + 1;
          const todayClass = isToday(day) ? " today" : "";
          const dragClass = dragOverDay === day ? " drag-over" : "";
          const dayPosts = postsForDay(day);

          return (
            <div
              key={day}
              className={`calendar-cell${todayClass}${dragClass}`}
              onDragOver={(e) => handleDragOver(e, day)}
              onDragLeave={handleDragLeave}
              onDrop={(e) => handleDrop(e, day)}
            >
              <div className="day-number">
                {isToday(day) ? (
                  <span className="today-badge">{day}</span>
                ) : (
                  day
                )}
              </div>

              <div className="day-posts">
                {dayPosts.map((post) => (
                  <div
                    key={post._id}
                    className={`calendar-post status-${post.status || "scheduled"}`}
                    draggable
                    onDragStart={() => handleDragStart(post)}
                  >
                    {/* Platform tags */}
                    <div className="calendar-post-platforms">
                      {(post.platforms || []).map((p) => (
                        <span key={p} className="calendar-platform-tag">
                          {platformAbbr(p)}
                        </span>
                      ))}
                    </div>

                    {/* Truncated text */}
                    <div className="calendar-post-text">
                      {truncateText(post.cards?.[0]?.text)}
                    </div>

                    {/* Time + delete */}
                    <div className="calendar-post-actions">
                      <span className="calendar-post-time">
                        {formatTime(post.scheduledAt)}
                      </span>
                      <button
                        type="button"
                        className="calendar-delete"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDelete(post._id);
                        }}
                        aria-label="Delete post"
                      >
                        ✕
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
