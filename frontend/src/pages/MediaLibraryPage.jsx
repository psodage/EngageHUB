import { useState } from "react";
import { Image, Video, Upload, Search, Filter, Trash2, FolderPlus, Grid, List, Plus } from "lucide-react";

export default function MediaLibraryPage() {
  const [viewMode, setViewMode] = useState("grid");
  const [searchQuery, setSearchQuery] = useState("");
  const [uploading, setUploading] = useState(false);

  const mockMedia = [
    { id: 1, name: "summer_sale_banner.png", type: "image", size: "2.4 MB", url: "https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=300&auto=format&fit=crop&q=80", date: "June 10, 2026" },
    { id: 2, name: "product_launch_reel.mp4", type: "video", size: "18.5 MB", url: "https://images.unsplash.com/photo-1542751371-adc38448a05e?w=300&auto=format&fit=crop&q=80", date: "June 08, 2026" },
    { id: 3, name: "customer_testimonial.jpg", type: "image", size: "1.1 MB", url: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=300&auto=format&fit=crop&q=80", date: "June 05, 2026" },
    { id: 4, name: "office_vlog_snippet.mp4", type: "video", size: "12.2 MB", url: "https://images.unsplash.com/photo-1497366216548-37526070297c?w=300&auto=format&fit=crop&q=80", date: "June 02, 2026" },
    { id: 5, name: "branding_assets_logo.png", type: "image", size: "340 KB", url: "https://images.unsplash.com/photo-1626785774573-4b799315345d?w=300&auto=format&fit=crop&q=80", date: "May 28, 2026" },
    { id: 6, name: "promo_event_square.jpg", type: "image", size: "1.8 MB", url: "https://images.unsplash.com/photo-1511795409834-ef04bbd61622?w=300&auto=format&fit=crop&q=80", date: "May 24, 2026" },
  ];

  const handleUpload = () => {
    setUploading(true);
    setTimeout(() => {
      setUploading(false);
    }, 1500);
  };

  const filteredMedia = mockMedia.filter((m) =>
    m.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-6 p-6 bg-slate-50/50 dark:bg-slate-950/50 text-slate-800 dark:text-slate-200">
      {/* Title & Upload bar */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Media Library</h1>
          <p className="text-sm text-slate-500 mt-1">Upload, store, and manage your visual assets for social campaigns.</p>
        </div>
        
        <div className="flex items-center gap-3">
          <button
            onClick={handleUpload}
            disabled={uploading}
            className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 px-4 py-2.5 text-sm font-semibold text-white shadow-md shadow-indigo-600/10 hover:from-purple-700 hover:to-indigo-700 transition"
          >
            {uploading ? (
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
            ) : (
              <Upload size={16} />
            )}
            <span>{uploading ? "Uploading..." : "Upload Media"}</span>
          </button>
        </div>
      </div>

      {/* Toolbar Controls */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="relative flex-1 max-w-md">
          <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search files by name..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full rounded-xl border border-slate-200 bg-slate-50/50 py-2 pl-10 pr-4 text-sm focus:border-purple-500 focus:bg-white focus:outline-none dark:border-slate-800 dark:bg-slate-950"
          />
        </div>

        <div className="flex items-center gap-3 self-end sm:self-auto">
          <button className="flex items-center gap-1.5 rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold hover:bg-slate-50 dark:border-slate-800 dark:hover:bg-slate-800">
            <Filter size={14} />
            <span>Filter</span>
          </button>
          
          <button className="flex items-center gap-1.5 rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold hover:bg-slate-50 dark:border-slate-800 dark:hover:bg-slate-800">
            <FolderPlus size={14} />
            <span>New Folder</span>
          </button>

          <div className="h-5 w-px bg-slate-200 dark:bg-slate-800" />

          <div className="flex rounded-lg border border-slate-200 p-0.5 dark:border-slate-800">
            <button
              onClick={() => setViewMode("grid")}
              className={`rounded px-2 py-1.5 ${viewMode === "grid" ? "bg-slate-100 dark:bg-slate-800 text-purple-600" : "text-slate-400"}`}
            >
              <Grid size={14} />
            </button>
            <button
              onClick={() => setViewMode("list")}
              className={`rounded px-2 py-1.5 ${viewMode === "list" ? "bg-slate-100 dark:bg-slate-800 text-purple-600" : "text-slate-400"}`}
            >
              <List size={14} />
            </button>
          </div>
        </div>
      </div>

      {/* Content Area */}
      {viewMode === "grid" ? (
        <div className="grid gap-6 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
          {filteredMedia.map((media) => (
            <div key={media.id} className="group relative overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm transition-all duration-300 hover:shadow-md dark:border-slate-800 dark:bg-slate-900">
              <div className="relative aspect-square w-full overflow-hidden bg-slate-100 dark:bg-slate-950">
                <img
                  src={media.url}
                  alt={media.name}
                  className="h-full w-full object-cover transition duration-300 group-hover:scale-105"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-slate-900/60 via-transparent to-transparent opacity-0 transition group-hover:opacity-100 flex items-end justify-between p-3">
                  <span className="text-[10px] font-bold text-white uppercase tracking-wider bg-black/40 px-2 py-0.5 rounded-full backdrop-blur-sm">
                    {media.type}
                  </span>
                  <button className="rounded-lg bg-red-600 p-1.5 text-white hover:bg-red-700 transition">
                    <Trash2 size={12} />
                  </button>
                </div>
              </div>
              <div className="p-3">
                <p className="truncate text-xs font-semibold text-slate-800 dark:text-slate-200" title={media.name}>
                  {media.name}
                </p>
                <div className="mt-1 flex items-center justify-between text-[10px] text-slate-400">
                  <span>{media.size}</span>
                  <span>{media.date}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="rounded-2xl border border-slate-200/60 bg-white shadow-sm dark:border-slate-800/80 dark:bg-slate-900 overflow-hidden">
          <table className="w-full text-left border-collapse text-sm">
            <thead>
              <tr className="border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 text-xs font-bold uppercase tracking-wider text-slate-400">
                <th className="p-4">Asset</th>
                <th className="p-4">Type</th>
                <th className="p-4">Size</th>
                <th className="p-4">Upload Date</th>
                <th className="p-4 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {filteredMedia.map((media) => (
                <tr key={media.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30">
                  <td className="p-4 flex items-center gap-3">
                    <img src={media.url} alt="" className="h-10 w-10 rounded-lg object-cover bg-slate-100" />
                    <span className="font-semibold text-slate-800 dark:text-slate-200">{media.name}</span>
                  </td>
                  <td className="p-4">
                    <span className="inline-flex items-center gap-1 capitalize text-xs text-slate-500">
                      {media.type === "video" ? <Video size={12} /> : <Image size={12} />}
                      {media.type}
                    </span>
                  </td>
                  <td className="p-4 text-slate-500">{media.size}</td>
                  <td className="p-4 text-slate-500">{media.date}</td>
                  <td className="p-4 text-right">
                    <button className="rounded-lg p-2 text-slate-400 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950/30 dark:hover:text-red-400 transition">
                      <Trash2 size={14} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
