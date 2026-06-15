import { useState, useEffect, useCallback, useMemo } from "react";
import { Link, useNavigate } from "react-router-dom";
import { 
  MoreHorizontal, 
  Filter, 
  Calendar, 
  RefreshCw, 
  ArrowUpRight, 
  ArrowDownRight, 
  TrendingUp, 
  Users, 
  Target, 
  Trash2, 
  Edit,
  Clock,
  Sparkles,
  ExternalLink
} from "lucide-react";
import { useApp } from "../context/AppContext";
import { PLATFORM_BRAND_ICONS } from "../data/platformBrandIcons";
import { listScheduledPosts, deleteScheduledPost } from "../services/scheduleApi";

// Custom premium Sparkline drawing component
function Sparkline({ points, strokeColor = "#a855f7", id }) {
  const width = 180;
  const height = 45;
  const min = Math.min(...points);
  const max = Math.max(...points);
  const range = max - min || 1;
  
  const coords = points.map((val, idx) => {
    const x = (idx / (points.length - 1)) * width;
    const y = height - 4 - ((val - min) / range) * (height - 8);
    return { x, y };
  });

  let d = `M ${coords[0].x},${coords[0].y}`;
  for (let i = 1; i < coords.length; i++) {
    const prev = coords[i - 1];
    const curr = coords[i];
    const cp1x = prev.x + (curr.x - prev.x) / 3;
    const cp1y = prev.y;
    const cp2x = prev.x + 2 * (curr.x - prev.x) / 3;
    const cp2y = curr.y;
    d += ` C ${cp1x},${cp1y} ${cp2x},${cp2y} ${curr.x},${curr.y}`;
  }

  const fillD = `${d} L ${width},${height} L 0,${height} Z`;
  const gradId = `spark-grad-${id}`;

  return (
    <svg className="w-full h-12 mt-2" viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none">
      <defs>
        <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={strokeColor} stopOpacity="0.25" />
          <stop offset="100%" stopColor={strokeColor} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={fillD} fill={`url(#${gradId})`} />
      <path d={d} fill="none" stroke={strokeColor} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export default function SaaSDashboard() {
  const navigate = useNavigate();
  const { connectedAccounts, user, setToast } = useApp();
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  
  // Control Bar States
  const [selectedPlatform, setSelectedPlatform] = useState("all");
  const [dateRange, setDateRange] = useState("this-week");
  const [statusFilter, setStatusFilter] = useState("all");
  
  // Dropdown menu state for queue posts
  const [activeMenuId, setActiveMenuId] = useState(null);

  const firstName = useMemo(() => (user?.name || "there").split(" ")[0], [user]);

  // Load scheduled posts
  const loadPosts = useCallback(async (showIndicator = true) => {
    if (showIndicator) setLoading(true);
    try {
      const rows = await listScheduledPosts();
      setPosts(rows);
    } catch (err) {
      console.error(err);
    } finally {
      if (showIndicator) setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadPosts();
  }, [loadPosts]);

  // Refresh trigger
  const handleRefresh = async () => {
    setRefreshing(true);
    await loadPosts(false);
    setTimeout(() => {
      setRefreshing(false);
      setToast({ message: "Analytics & content queue refreshed!" });
    }, 600);
  };

  // Delete post trigger
  const handleDeletePost = async (id) => {
    try {
      await deleteScheduledPost(id);
      setToast({ message: "Scheduled post deleted successfully." });
      setPosts((prev) => prev.filter((p) => p._id !== id));
    } catch (err) {
      setToast({ message: err.message || "Failed to delete post.", error: true });
    }
  };

  // Connected accounts list
  const platformsList = useMemo(() => {
    const isLinked = (plat) => connectedAccounts.some((a) => a.platform === plat && a.isConnected);
    const getAccountName = (plat, defaultName) => {
      const match = connectedAccounts.find((a) => a.platform === plat && a.isConnected);
      return match ? (match.displayName || match.username || defaultName) : defaultName;
    };

    return [
      {
        key: "facebook",
        name: "Meta (Facebook)",
        status: isLinked("facebook") ? "Connected / Syncing" : "Connected / Syncing", // Force mockup connected as per request
        isConnected: true,
        accountName: getAccountName("facebook", "EngageHub Workspace"),
        icon: PLATFORM_BRAND_ICONS.facebook,
        iconColor: "text-blue-600 bg-blue-50 dark:bg-blue-950/35"
      },
      {
        key: "instagram",
        name: "Instagram",
        status: isLinked("instagram") ? "Connected" : "Connected",
        isConnected: true,
        accountName: getAccountName("instagram", "@engagehub_app"),
        icon: PLATFORM_BRAND_ICONS.instagram,
        iconColor: "text-pink-600 bg-pink-50 dark:bg-pink-950/35"
      },
      {
        key: "googleBusiness",
        name: "Google Business Profile",
        status: isLinked("googleBusiness") ? "Connected" : "Connected",
        isConnected: true,
        accountName: getAccountName("googleBusiness", "EngageHub HQ"),
        icon: PLATFORM_BRAND_ICONS.googleBusiness,
        iconColor: "text-blue-500 bg-blue-50 dark:bg-blue-950/35"
      },
      {
        key: "x",
        name: "X (Twitter)",
        status: isLinked("x") ? "Connected" : "Connect Account",
        isConnected: isLinked("x"),
        accountName: isLinked("x") ? getAccountName("x", "@engagehub_x") : "Not Connected",
        icon: PLATFORM_BRAND_ICONS.x,
        iconColor: "text-slate-800 bg-slate-100 dark:text-white dark:bg-slate-800"
      }
    ];
  }, [connectedAccounts]);

  // Combine real database posts with premium high-fidelity mockup posts to ensure a rich queue representation
  const contentQueue = useMemo(() => {
    const dbItems = posts.map((post) => ({
      id: post._id,
      title: post.caption?.slice(0, 50) || post.title || "Social Media Campaign Post",
      platforms: post.channelKeys || ["facebook", "instagram"],
      status: post.status === "publishing" ? "Draft" : post.status === "failed" ? "Failed" : post.status === "published" ? "Published" : "Scheduled",
      prediction: "High",
      time: new Date(post.scheduledAt || Date.now() + 86400000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      dateLabel: "Tomorrow, " + new Date(post.scheduledAt || Date.now() + 86400000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      isMock: false
    }));

    const mockItems = [
      {
        id: "mock-1",
        title: "☀️ Summer Sale Announcement: 30% off all subscriptions starting this Monday!",
        platforms: ["facebook", "instagram"],
        status: "Scheduled",
        prediction: "High",
        dateLabel: "Tomorrow, 10:00 AM",
        isMock: true
      },
      {
        id: "mock-2",
        title: "💡 Content Strategy Checklist: How we doubled our reach in under 3 weeks.",
        platforms: ["instagram", "googleBusiness"],
        status: "Draft",
        prediction: "Medium",
        dateLabel: "June 15, 2:30 PM",
        isMock: true
      },
      {
        id: "mock-3",
        title: "⚡ Systems upgrade notice - API endpoints migration for smoother integrations.",
        platforms: ["facebook", "googleBusiness"],
        status: "Failed",
        prediction: "Low",
        dateLabel: "Yesterday, 4:00 PM",
        isMock: true
      }
    ];

    const all = [...dbItems, ...mockItems];

    // Filter by platform
    const platformFiltered = selectedPlatform === "all" 
      ? all 
      : all.filter((item) => item.platforms.includes(selectedPlatform));

    // Filter by status
    const statusFiltered = statusFilter === "all"
      ? platformFiltered
      : platformFiltered.filter((item) => item.status.toLowerCase() === statusFilter.toLowerCase());

    return statusFiltered;
  }, [posts, selectedPlatform, statusFilter]);

  // Analytics mock datasets
  const analyticsData = [
    {
      name: "Total Reach",
      value: "24.5k",
      change: "+12% this week",
      trend: "up",
      points: [12, 14, 18, 15, 21, 23, 24.5],
      strokeColor: "#8b5cf6" // Purple
    },
    {
      name: "Post Engagements",
      value: "1,204",
      change: "+8% this week",
      trend: "up",
      points: [850, 920, 1010, 980, 1120, 1190, 1204],
      strokeColor: "#ec4899" // Pink
    },
    {
      name: "Profile Clicks",
      value: "418",
      change: "+18% this week",
      trend: "up",
      points: [290, 310, 320, 360, 380, 400, 418],
      strokeColor: "#3b82f6" // Blue
    }
  ];

  return (
    <div className="relative flex min-h-0 flex-1 flex-col gap-8 p-6 bg-slate-50/50 dark:bg-slate-950/50 text-slate-800 dark:text-slate-200 overflow-y-auto">
      {/* Background glow decoration */}
      <div className="absolute top-0 right-0 -z-10 h-96 w-96 rounded-full bg-gradient-to-tr from-purple-200/20 via-pink-200/10 to-blue-200/20 blur-3xl" />

      {/* Greeting Header */}
      <div className="flex flex-col gap-2">
        <h2 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white flex items-center gap-2">
          Good to see you, {firstName}! <Sparkles size={20} className="text-purple-500 animate-pulse" />
        </h2>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Manage cross-platform postings, track OAuth integrations, and review real-time reach analytics.
        </p>
      </div>

      {/* A. Connected Platforms Grid */}
      <section className="flex flex-col gap-3">
        <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">Connected Social Platforms</h3>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {platformsList.map((plat) => {
            const Icon = plat.icon;
            return (
              <div 
                key={plat.key} 
                className="flex items-center gap-4 rounded-2xl border border-slate-200/60 bg-white p-4 shadow-sm dark:border-slate-800/80 dark:bg-slate-900 transition-all duration-300 hover:shadow-md hover:border-slate-300/80 dark:hover:border-slate-700"
              >
                <div className={`rounded-xl p-2.5 ${plat.iconColor} shrink-0`}>
                  <Icon size={20} />
                </div>
                
                <div className="min-w-0 flex-1">
                  <span className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider">{plat.name}</span>
                  <span className="block truncate text-sm font-semibold text-slate-800 dark:text-slate-200 mt-0.5">{plat.accountName}</span>
                  
                  {/* Status Indicator */}
                  <div className="flex items-center gap-1.5 mt-1">
                    <span className={`h-2 w-2 rounded-full ${plat.isConnected ? "bg-emerald-500 animate-pulse" : "bg-slate-300 dark:bg-slate-600"}`} />
                    <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400">{plat.status}</span>
                  </div>
                </div>

                {!plat.isConnected && (
                  <button
                    onClick={() => navigate("/channels")}
                    className="rounded-xl border border-purple-200 bg-purple-50/50 hover:bg-purple-100 dark:border-purple-900/40 dark:bg-purple-950/30 px-3 py-1.5 text-xs font-bold text-purple-700 dark:text-purple-400 transition"
                  >
                    Connect
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </section>

      {/* B. Content Controls Bar */}
      <section className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between rounded-2xl border border-slate-200/60 bg-white p-4 shadow-sm dark:border-slate-800/80 dark:bg-slate-900">
        <div className="flex flex-wrap items-center gap-3">
          {/* Platform Filter */}
          <div className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-slate-50/50 px-3 py-1.5 dark:border-slate-800 dark:bg-slate-950">
            <Filter size={13} className="text-slate-400" />
            <select
              value={selectedPlatform}
              onChange={(e) => setSelectedPlatform(e.target.value)}
              className="bg-transparent border-none text-xs font-semibold text-slate-700 focus:outline-none dark:text-slate-300 cursor-pointer"
            >
              <option value="all">All Platforms</option>
              <option value="facebook">Meta (Facebook)</option>
              <option value="instagram">Instagram</option>
              <option value="googleBusiness">Google Business</option>
              <option value="x">X (Twitter)</option>
            </select>
          </div>

          {/* Date Picker (Display Mock) */}
          <div className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-slate-50/50 px-3 py-1.5 dark:border-slate-800 dark:bg-slate-950">
            <Calendar size={13} className="text-slate-400" />
            <select
              value={dateRange}
              onChange={(e) => setDateRange(e.target.value)}
              className="bg-transparent border-none text-xs font-semibold text-slate-700 focus:outline-none dark:text-slate-300 cursor-pointer"
            >
              <option value="today">Today</option>
              <option value="this-week">This Week</option>
              <option value="next-30-days">Next 30 Days</option>
            </select>
          </div>

          {/* Status Toggle buttons */}
          <div className="flex rounded-xl border border-slate-200 p-0.5 bg-slate-50/50 dark:border-slate-800 dark:bg-slate-950">
            {["all", "scheduled", "draft", "failed"].map((status) => (
              <button
                key={status}
                onClick={() => setStatusFilter(status)}
                className={`rounded-lg px-3 py-1 text-xs font-bold capitalize transition duration-150 ${
                  statusFilter === status
                    ? "bg-white text-purple-700 shadow-sm dark:bg-slate-850 dark:text-purple-400"
                    : "text-slate-500 hover:text-slate-700 dark:text-slate-450 dark:hover:text-slate-350"
                }`}
              >
                {status}
              </button>
            ))}
          </div>
        </div>

        {/* Right-aligned Refresh analytics button */}
        <button
          onClick={handleRefresh}
          className="flex items-center justify-center gap-1.5 rounded-xl border border-slate-200 hover:bg-slate-50 px-4 py-2 text-xs font-semibold text-slate-600 dark:border-slate-800 dark:text-slate-400 dark:hover:bg-slate-800 transition shadow-sm"
        >
          <RefreshCw size={14} className={refreshing ? "animate-spin text-purple-600" : ""} />
          <span>Refresh Analytics</span>
        </button>
      </section>

      {/* C. Upcoming Posts (Content Queue) */}
      <section className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">Upcoming Content Queue</h3>
          <Link to="/schedule" className="text-xs font-bold text-purple-600 hover:underline dark:text-purple-400">
            View Calendar →
          </Link>
        </div>

        <div className="flex flex-col gap-3 rounded-2xl border border-slate-200/60 bg-white p-4 shadow-sm dark:border-slate-800/80 dark:bg-slate-900">
          {contentQueue.length === 0 ? (
            <div className="py-8 text-center text-sm text-slate-500">
              No upcoming posts match your filter.
            </div>
          ) : (
            <div className="flex flex-col divide-y divide-slate-100 dark:divide-slate-800">
              {contentQueue.map((item) => (
                <div 
                  key={item.id} 
                  className="flex items-center justify-between gap-4 py-3.5 first:pt-0 last:pb-0 relative group"
                >
                  {/* Post Preview Info */}
                  <div className="min-w-0 flex-1 flex items-center gap-3">
                    <div className="h-10 w-10 shrink-0 rounded-lg bg-purple-50 dark:bg-purple-950/35 border border-purple-100/50 dark:border-purple-900/30 flex items-center justify-center text-purple-600 dark:text-purple-400 text-xs font-bold uppercase overflow-hidden">
                      {item.title.substring(0, 2)}
                    </div>
                    
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-slate-800 dark:text-slate-200 leading-snug">
                        {item.title}
                      </p>
                      
                      {/* Sub-meta tags */}
                      <div className="flex flex-wrap items-center gap-2.5 mt-1.5">
                        {/* Platform badges */}
                        <div className="flex items-center gap-1">
                          {item.platforms.map((plat) => {
                            const PlatIcon = PLATFORM_BRAND_ICONS[plat];
                            return PlatIcon ? (
                              <span key={plat} className="text-slate-400 hover:text-slate-600" title={plat}>
                                <PlatIcon size={12} />
                              </span>
                            ) : null;
                          })}
                        </div>
                        
                        <span className="text-[10px] text-slate-300 dark:text-slate-700">•</span>
                        
                        {/* Time */}
                        <span className="text-xs text-slate-500 font-medium">{item.dateLabel}</span>
                        
                        <span className="text-[10px] text-slate-300 dark:text-slate-700">•</span>

                        {/* Engagement Prediction Tag */}
                        <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold ${
                          item.prediction === "High"
                            ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400"
                            : item.prediction === "Medium"
                            ? "bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-400"
                            : "bg-blue-50 text-blue-700 dark:bg-blue-500/10 dark:text-blue-400"
                        }`}>
                          Prediction: {item.prediction}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Right side: Status and Actions */}
                  <div className="flex items-center gap-4">
                    {/* Status Badge */}
                    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                      item.status === "Scheduled"
                        ? "bg-blue-50 text-blue-700 dark:bg-blue-500/10 dark:text-blue-400"
                        : item.status === "Draft"
                        ? "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-400"
                        : "bg-red-50 text-red-700 dark:bg-red-500/10 dark:text-red-400"
                    }`}>
                      {item.status}
                    </span>

                    {/* Action Dropdown Menu */}
                    <div className="relative">
                      <button
                        onClick={() => setActiveMenuId(activeMenuId === item.id ? null : item.id)}
                        className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-50 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-200 transition"
                      >
                        <MoreHorizontal size={16} />
                      </button>

                      {activeMenuId === item.id && (
                        <>
                          <div 
                            className="fixed inset-0 z-30" 
                            onClick={() => setActiveMenuId(null)} 
                          />
                          <div className="absolute right-0 mt-1.5 w-36 rounded-xl border border-slate-200 bg-white p-1 shadow-lg dark:border-slate-800 dark:bg-slate-900 z-40">
                            {!item.isMock ? (
                              <>
                                <button
                                  onClick={() => {
                                    setActiveMenuId(null);
                                    navigate(`/schedule/${item.id}`);
                                  }}
                                  className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-left text-xs font-semibold text-slate-750 hover:bg-slate-50 dark:text-slate-200 dark:hover:bg-slate-800 transition"
                                >
                                  <Edit size={12} />
                                  Edit Post
                                </button>
                                <button
                                  onClick={() => {
                                    setActiveMenuId(null);
                                    handleDeletePost(item.id);
                                  }}
                                  className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-left text-xs font-semibold text-red-650 hover:bg-red-50 dark:hover:bg-red-950/20 transition"
                                >
                                  <Trash2 size={12} />
                                  Delete
                                </button>
                              </>
                            ) : (
                              <button
                                onClick={() => {
                                  setActiveMenuId(null);
                                  alert("Mock content cannot be edited.");
                                }}
                                className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-left text-xs font-semibold text-slate-400 transition cursor-not-allowed"
                              >
                                Mock View Only
                              </button>
                            )}
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* D. Performance Analytics Section */}
      <section className="flex flex-col gap-3">
        <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">Performance Analytics</h3>
        
        <div className="grid gap-4 md:grid-cols-3">
          {analyticsData.map((data, index) => (
            <div 
              key={data.name} 
              className="flex flex-col justify-between rounded-2xl border border-slate-200/60 bg-white p-5 shadow-sm dark:border-slate-800/80 dark:bg-slate-900 transition-all duration-300 hover:shadow-md"
            >
              <div>
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold text-slate-500 dark:text-slate-400">{data.name}</span>
                  <span className="flex items-center gap-0.5 text-xs font-bold text-emerald-500">
                    <ArrowUpRight size={13} />
                    {data.change}
                  </span>
                </div>
                
                <h4 className="mt-3 text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white">
                  {data.value}
                </h4>
              </div>

              {/* Sparkline gradient curve */}
              <div className="mt-4">
                <Sparkline points={data.points} strokeColor={data.strokeColor} id={index} />
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
