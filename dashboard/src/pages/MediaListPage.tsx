import { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import api from '../api';
import Pagination from '../components/Pagination';
import ConfirmDialog from '../components/ConfirmDialog';
import CopyButton from '../components/CopyButton';
import UploadZone from '../components/UploadZone';

interface MediaItem {
  id: string;
  originalname: string;
  filename: string;
  mimetype: string;
  size: number;
  type: string;
  views: number;
  createdAt: string;
  directLink: string;
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

export default function MediaListPage() {
  const [items, setItems] = useState<MediaItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState(false);
  const limit = 20;

  const fetchMedia = useCallback(() => {
    setLoading(true);
    const params: Record<string, string | number> = { page, limit };
    if (search) params.search = search;
    if (typeFilter) params.type = typeFilter;
    api
      .get('/media', { params })
      .then((res) => {
        setItems(res.data.items);
        setTotal(res.data.total);
        setTotalPages(res.data.totalPages);
      })
      .finally(() => setLoading(false));
  }, [page, search, typeFilter]);

  useEffect(() => {
    fetchMedia();
  }, [fetchMedia]);

  const toggleSelect = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectAll = () => {
    if (selected.size === items.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(items.map((i) => i.id)));
    }
  };

  const handleBulkDelete = async () => {
    await api.post('/media/bulk-delete', { ids: Array.from(selected) });
    setSelected(new Set());
    setShowConfirm(false);
    fetchMedia();
  };

  const handleBatchDownload = async () => {
    setDownloading(true);
    try {
      const res = await api.post(
        '/download',
        { ids: Array.from(selected) },
        { responseType: 'blob' },
      );
      const url = URL.createObjectURL(res.data);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'media-download.zip';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch {
      // Download failed silently
    } finally {
      setDownloading(false);
    }
  };

  const handleSearch = (value: string) => {
    setSearch(value);
    setPage(1);
  };

  return (
    <div>
      <UploadZone onUploadComplete={fetchMedia} />

      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-semibold text-white">
          Media{' '}
          <span className="text-gray-500 text-sm font-normal">({total})</span>
        </h2>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setViewMode('grid')}
            className={`px-3 py-1.5 text-sm rounded-lg transition-colors ${
              viewMode === 'grid'
                ? 'bg-blue-600 text-white'
                : 'bg-gray-800 text-gray-400'
            }`}
          >
            Grid
          </button>
          <button
            onClick={() => setViewMode('list')}
            className={`px-3 py-1.5 text-sm rounded-lg transition-colors ${
              viewMode === 'list'
                ? 'bg-blue-600 text-white'
                : 'bg-gray-800 text-gray-400'
            }`}
          >
            List
          </button>
        </div>
      </div>

      <div className="flex gap-3 mb-4">
        <input
          type="text"
          placeholder="Search files..."
          value={search}
          onChange={(e) => handleSearch(e.target.value)}
          className="flex-1 px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm focus:outline-none focus:border-blue-500 transition-colors"
        />
        <select
          value={typeFilter}
          onChange={(e) => {
            setTypeFilter(e.target.value);
            setPage(1);
          }}
          className="px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm focus:outline-none focus:border-blue-500"
        >
          <option value="">All types</option>
          <option value="image">Images</option>
          <option value="video">Videos</option>
          <option value="audio">Audio</option>
        </select>
      </div>

      {selected.size > 0 && (
        <div className="flex items-center gap-3 mb-4 p-3 bg-gray-900 border border-gray-800 rounded-lg">
          <span className="text-sm text-gray-400">
            {selected.size} selected
          </span>
          <button
            onClick={handleBatchDownload}
            disabled={downloading}
            className="px-3 py-1.5 text-sm bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-lg transition-colors"
          >
            {downloading ? 'Downloading...' : 'Download Selected'}
          </button>
          <button
            onClick={() => setShowConfirm(true)}
            className="px-3 py-1.5 text-sm bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors"
          >
            Delete Selected
          </button>
          <button
            onClick={() => setSelected(new Set())}
            className="px-3 py-1.5 text-sm text-gray-400 hover:text-white transition-colors"
          >
            Clear
          </button>
        </div>
      )}

      {loading ? (
        <div className="text-gray-500 text-sm">Loading...</div>
      ) : viewMode === 'grid' ? (
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-3 mb-6">
          {items.map((item) => (
            <div
              key={item.id}
              className={`group relative bg-gray-900 border rounded-xl overflow-hidden transition-colors ${
                selected.has(item.id) ? 'border-blue-500' : 'border-gray-800'
              }`}
            >
              <div
                className="absolute top-2 left-2 z-10 cursor-pointer"
                onClick={() => toggleSelect(item.id)}
              >
                <div
                  className={`w-5 h-5 rounded border-2 flex items-center justify-center text-xs transition-colors ${
                    selected.has(item.id)
                      ? 'bg-blue-600 border-blue-600 text-white'
                      : 'border-gray-600 bg-gray-900/80'
                  }`}
                >
                  {selected.has(item.id) && '✓'}
                </div>
              </div>
              <div className="absolute top-2 right-2 z-10 opacity-0 group-hover:opacity-100 transition-opacity">
                <CopyButton
                  text={item.directLink}
                  className="p-1.5 bg-gray-900/80 rounded-lg text-gray-400 hover:text-white"
                />
              </div>
              <Link to={`/media/${item.id}`}>
                <div className="aspect-square bg-gray-800 flex items-center justify-center overflow-hidden">
                  {item.type === 'image' ? (
                    <img
                      src={item.directLink}
                      alt={item.originalname}
                      className="w-full h-full object-cover"
                      loading="lazy"
                    />
                  ) : (
                    <span className="text-gray-600 text-xs uppercase">
                      {item.type}
                    </span>
                  )}
                </div>
                <div className="p-2.5">
                  <p className="text-xs text-gray-300 truncate">
                    {item.originalname}
                  </p>
                  <p className="text-xs text-gray-600 mt-0.5">
                    {formatBytes(item.size)}
                  </p>
                </div>
              </Link>
            </div>
          ))}
        </div>
      ) : (
        <div className="mb-6">
          <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
            <div className="grid grid-cols-[auto_1fr_auto_auto_auto_auto] gap-4 px-4 py-2 border-b border-gray-800 text-xs text-gray-500 uppercase tracking-wider">
              <div className="w-5">
                <div
                  className="w-5 h-5 rounded border-2 border-gray-600 flex items-center justify-center text-xs cursor-pointer"
                  onClick={selectAll}
                >
                  {selected.size === items.length && items.length > 0 && '✓'}
                </div>
              </div>
              <div>Name</div>
              <div>Type</div>
              <div>Size</div>
              <div>Views</div>
              <div></div>
            </div>
            {items.map((item) => (
              <div
                key={item.id}
                className={`grid grid-cols-[auto_1fr_auto_auto_auto_auto] gap-4 px-4 py-3 border-b border-gray-800/50 items-center hover:bg-gray-800/30 transition-colors ${
                  selected.has(item.id) ? 'bg-blue-900/10' : ''
                }`}
              >
                <div
                  className="cursor-pointer"
                  onClick={() => toggleSelect(item.id)}
                >
                  <div
                    className={`w-5 h-5 rounded border-2 flex items-center justify-center text-xs transition-colors ${
                      selected.has(item.id)
                        ? 'bg-blue-600 border-blue-600 text-white'
                        : 'border-gray-600'
                    }`}
                  >
                    {selected.has(item.id) && '✓'}
                  </div>
                </div>
                <Link
                  to={`/media/${item.id}`}
                  className="text-sm text-gray-300 hover:text-white truncate transition-colors"
                >
                  {item.originalname}
                </Link>
                <span className="text-xs text-gray-500 capitalize">
                  {item.type}
                </span>
                <span className="text-xs text-gray-500">
                  {formatBytes(item.size)}
                </span>
                <span className="text-xs text-gray-500">{item.views}</span>
                <CopyButton
                  text={item.directLink}
                  className="text-gray-500 hover:text-white"
                />
              </div>
            ))}
          </div>
        </div>
      )}

      <Pagination page={page} totalPages={totalPages} onPageChange={setPage} />

      <ConfirmDialog
        open={showConfirm}
        title="Delete Selected"
        message={`Are you sure you want to delete ${selected.size} file(s)? This cannot be undone.`}
        onConfirm={handleBulkDelete}
        onCancel={() => setShowConfirm(false)}
      />
    </div>
  );
}
