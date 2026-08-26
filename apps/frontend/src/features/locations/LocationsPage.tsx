import { useState, useEffect, useMemo, FormEvent } from 'react';
import { LocationDto, LocationType, LocationStatus, UserRole, roleAtLeast } from '@nest/shared-types';
import {
  fetchLocations,
  fetchLocation,
  createLocation,
  updateLocation,
  updateLocationStatus,
  archiveLocation,
} from '../../api-client/locations';
import { ApiError } from '../../api-client/client';
import { useAuth } from '../../app/AuthContext';
import { LocationBreadcrumb } from './LocationBreadcrumb';
import { LocationTypeahead } from './LocationTypeahead';

interface TreeNode extends LocationDto {
  children: TreeNode[];
}

export function LocationsPage() {
  const { user } = useAuth();
  const isStoresManager = user ? roleAtLeast(user.role, UserRole.STORES_MANAGER) : false;
  const isStudentOrAbove = user ? roleAtLeast(user.role, UserRole.STUDENT) : false;

  const [locations, setLocations] = useState<LocationDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  // Selected node details
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedDetail, setSelectedDetail] = useState<LocationDto | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [statusLoading, setStatusLoading] = useState(false);

  // Tree UI state: expanded node IDs
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

  // Edit / Create mode
  const [isEditing, setIsEditing] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [formSubmitting, setFormSubmitting] = useState(false);

  // Form fields
  const [formName, setFormName] = useState('');
  const [formType, setFormType] = useState<LocationType>(LocationType.ROOM);
  const [formParentId, setFormParentId] = useState<string | null>(null);
  const [formDescription, setFormDescription] = useState('');

  // Archive modal state
  const [showArchiveModal, setShowArchiveModal] = useState(false);
  const [archiveError, setArchiveError] = useState<string | null>(null);
  const [archiving, setArchiving] = useState(false);

  const loadLocations = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchLocations({});
      setLocations(data);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to load locations.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadLocations();
  }, []);

  // Fetch full details (with breadcrumb) when selectedId changes
  useEffect(() => {
    if (!selectedId) {
      setSelectedDetail(null);
      return;
    }
    let cancelled = false;
    async function loadDetail() {
      setDetailLoading(true);
      try {
        const detail = await fetchLocation(selectedId!);
        if (!cancelled) setSelectedDetail(detail);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof ApiError ? err.message : 'Failed to load location detail.');
        }
      } finally {
        if (!cancelled) setDetailLoading(false);
      }
    }
    loadDetail();
    return () => {
      cancelled = true;
    };
  }, [selectedId]);

  // Build tree from flat locations list
  const treeNodes = useMemo(() => {
    const nodeMap = new Map<string, TreeNode>();
    locations.forEach((loc) => {
      nodeMap.set(loc.id, { ...loc, children: [] });
    });

    const rootNodes: TreeNode[] = [];
    locations.forEach((loc) => {
      const node = nodeMap.get(loc.id)!;
      if (loc.parent_location_id && nodeMap.has(loc.parent_location_id)) {
        nodeMap.get(loc.parent_location_id)!.children.push(node);
      } else {
        rootNodes.push(node);
      }
    });

    return rootNodes;
  }, [locations]);

  // Filtered nodes based on search query
  const filteredTreeNodes = useMemo(() => {
    if (!searchQuery.trim()) return treeNodes;
    const q = searchQuery.toLowerCase();

    function filterNode(node: TreeNode): TreeNode | null {
      const nameMatch = node.name.toLowerCase().includes(q);
      const typeMatch = node.type.toLowerCase().includes(q);
      const matchingChildren = node.children
        .map(filterNode)
        .filter((child): child is TreeNode => child !== null);

      if (nameMatch || typeMatch || matchingChildren.length > 0) {
        return {
          ...node,
          children: matchingChildren,
        };
      }
      return null;
    }

    return treeNodes.map(filterNode).filter((node): node is TreeNode => node !== null);
  }, [treeNodes, searchQuery]);

  const toggleExpand = (id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleSelectNode = (loc: LocationDto) => {
    setSelectedId(loc.id);
    setIsEditing(false);
    setIsCreating(false);
    setFormError(null);
  };

  const handleStartCreate = (parentId: string | null = null) => {
    setIsCreating(true);
    setIsEditing(false);
    setFormName('');
    setFormType(LocationType.ROOM);
    setFormParentId(parentId);
    setFormDescription('');
    setFormError(null);
  };

  const handleStartEdit = () => {
    if (!selectedDetail) return;
    setIsEditing(true);
    setIsCreating(false);
    setFormName(selectedDetail.name);
    setFormType(selectedDetail.type);
    setFormParentId(selectedDetail.parent_location_id);
    setFormDescription(selectedDetail.description ?? '');
    setFormError(null);
  };

  const handleFormSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setFormError(null);
    setFormSubmitting(true);

    try {
      if (isCreating) {
        const created = await createLocation({
          name: formName.trim(),
          type: formType,
          parent_location_id: formParentId,
          description: formDescription.trim() || null,
        });
        await loadLocations();
        setSelectedId(created.id);
        setIsCreating(false);
      } else if (isEditing && selectedId) {
        const updated = await updateLocation(selectedId, {
          name: formName.trim(),
          type: formType,
          parent_location_id: formParentId,
          description: formDescription.trim() || null,
        });
        await loadLocations();
        setSelectedDetail(updated);
        setIsEditing(false);
      }
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.code === 'LOCATION_CYCLE') {
          setFormError('Circular dependency error: A location cannot be set as a parent of its own ancestor.');
        } else {
          setFormError(err.message);
        }
      } else {
        setFormError('Failed to save location.');
      }
    } finally {
      setFormSubmitting(false);
    }
  };

  const handleArchiveConfirm = async () => {
    if (!selectedId) return;
    setArchiveError(null);
    setArchiving(true);
    try {
      await archiveLocation(selectedId);
      await loadLocations();
      setShowArchiveModal(false);
      setSelectedId(null);
      setSelectedDetail(null);
    } catch (err) {
      setArchiveError(err instanceof ApiError ? err.message : 'Failed to archive location.');
    } finally {
      setArchiving(false);
    }
  };

  const handleStatusChange = async (newStatus: LocationStatus) => {
    if (!selectedId || !selectedDetail) return;
    setStatusLoading(true);
    try {
      const updated = await updateLocationStatus(selectedId, newStatus);
      setSelectedDetail(updated);
      await loadLocations();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to update location status.');
    } finally {
      setStatusLoading(false);
    }
  };

  // Render tree node recursively
  const renderTreeNode = (node: TreeNode, depth = 0) => {
    const isExpanded = expandedIds.has(node.id) || searchQuery.trim().length > 0;
    const hasChildren = node.children.length > 0;
    const isSelected = selectedId === node.id;

    return (
      <div key={node.id} className="select-none">
        <div
          onClick={() => handleSelectNode(node)}
          className={`flex items-center justify-between px-3 py-2 text-sm rounded-xl cursor-pointer transition-all ${
            isSelected
              ? 'neu-inset text-blue-600 font-bold'
              : 'text-gray-700 hover:text-blue-600'
          }`}
          style={{ paddingLeft: `${depth * 1.25 + 0.75}rem` }}
        >
          <div className="flex items-center gap-2 truncate">
            {hasChildren ? (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  toggleExpand(node.id);
                }}
                className="w-4 h-4 flex items-center justify-center text-gray-500 hover:text-gray-800 font-bold"
              >
                {isExpanded ? '▼' : '▶'}
              </button>
            ) : (
              <span className="w-4" />
            )}
            <span className="truncate">{node.name}</span>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs px-2 py-1 rounded-md neu-inset font-mono text-gray-500 font-medium">
              {node.type}
            </span>
            <span className={`text-xs px-2 py-1 rounded-md font-mono neu-inset font-bold ${node.status === LocationStatus.OPEN ? 'text-green-600' : node.status === LocationStatus.CLOSED ? 'text-red-600' : 'text-gray-500'}`}>
              {node.status}
            </span>
            {!node.is_active && (
              <span className="text-xs px-2 py-1 rounded-md neu-inset text-amber-600 font-bold">
                Archived
              </span>
            )}
          </div>
        </div>

        {hasChildren && isExpanded && (
          <div className="space-y-0.5">
            {node.children.map((child) => renderTreeNode(child, depth + 1))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Locations</h1>
          <p className="text-sm text-gray-600">
            {isStoresManager
              ? 'Manage physical locations, hierarchies, and sub-locations.'
              : 'View location hierarchy and details.'}
          </p>
        </div>

        {isStoresManager && (
          <button
            type="button"
            onClick={() => handleStartCreate(null)}
            className="neu-button px-6 py-2.5 rounded-xl text-sm font-bold text-blue-600 transition-all"
          >
            + Add Location
          </button>
        )}
      </div>

      {error && (
        <div role="alert" className="rounded-xl p-4 text-sm neu-inset text-red-600 font-medium">
          {error}
        </div>
      )}

      {/* Main Grid: Tree View (Left) vs Detail/Edit Panel (Right) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Locations Tree */}
        <div className="lg:col-span-5 neu-flat rounded-xl p-6 space-y-5">
          <div>
            <input
              type="text"
              placeholder="Search locations..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full neu-inset rounded-xl px-4 py-3 text-sm outline-none text-gray-700"
            />
          </div>

          {loading ? (
            <div className="text-center py-8 text-sm text-gray-500 font-medium">Loading locations…</div>
          ) : filteredTreeNodes.length === 0 ? (
            <div className="text-center py-8 text-sm text-gray-500 font-medium">
              {searchQuery ? `No locations matching "${searchQuery}".` : 'No locations registered yet.'}
            </div>
          ) : (
            <div className="space-y-1 max-h-[600px] overflow-y-auto pr-2 custom-scrollbar">
              {filteredTreeNodes.map((node) => renderTreeNode(node))}
            </div>
          )}
        </div>

        {/* Right Column: Selected Node Detail / Edit / Create Form */}
        <div className="lg:col-span-7 neu-flat p-6 md:p-8 flex flex-col h-full">
          {isCreating || isEditing ? (
            /* Create / Edit Form */
            <form onSubmit={handleFormSubmit} className="space-y-5">
              <h2 className="text-lg font-semibold text-gray-700 border-b border-gray-200/50 pb-3">
                {isCreating ? 'Create Location' : `Edit ${selectedDetail?.name}`}
              </h2>

              {formError && (
                <div role="alert" className="rounded-xl p-3 text-sm neu-inset text-red-600 font-medium">
                  {formError}
                </div>
              )}

              <div>
                <label htmlFor="loc-name" className="block text-sm font-medium text-gray-600 mb-2">
                  Location Name *
                </label>
                <input
                  id="loc-name"
                  type="text"
                  required
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  className="w-full neu-inset rounded-xl px-4 py-3 text-sm outline-none text-gray-700"
                />
              </div>

              <div>
                <label htmlFor="loc-type" className="block text-sm font-medium text-gray-600 mb-2">
                  Location Type *
                </label>
                <select
                  id="loc-type"
                  value={formType}
                  onChange={(e) => setFormType(e.target.value as LocationType)}
                  className="w-full neu-inset rounded-xl px-4 py-3 text-sm outline-none text-gray-700 bg-transparent"
                >
                  {Object.values(LocationType).map((t) => (
                    <option key={t} value={t}>
                      {t.toUpperCase()}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-600 mb-2">
                  Parent Location
                </label>
                <LocationTypeahead
                  locations={locations}
                  value={formParentId}
                  onChange={setFormParentId}
                  excludeId={isEditing ? selectedId ?? undefined : undefined}
                />
              </div>

              <div>
                <label htmlFor="loc-desc" className="block text-sm font-medium text-gray-600 mb-2">
                  Description
                </label>
                <textarea
                  id="loc-desc"
                  rows={3}
                  value={formDescription}
                  onChange={(e) => setFormDescription(e.target.value)}
                  className="w-full neu-inset rounded-xl px-4 py-3 text-sm outline-none text-gray-700 resize-y"
                />
              </div>

              <div className="flex items-center gap-3 pt-4 border-t border-gray-200/50">
                <button
                  type="submit"
                  disabled={formSubmitting}
                  className="neu-button px-6 py-2.5 rounded-xl text-sm font-bold text-blue-600 transition-all"
                >
                  {formSubmitting ? 'Saving…' : 'Save Location'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setIsCreating(false);
                    setIsEditing(false);
                    setFormError(null);
                  }}
                  className="neu-button px-6 py-2.5 rounded-xl text-sm font-bold text-gray-500 hover:text-gray-700 transition-all"
                >
                  Cancel
                </button>
              </div>
            </form>
          ) : detailLoading ? (
            <div className="py-12 text-center text-sm text-gray-500">Loading details…</div>
          ) : selectedDetail ? (
            /* Selected Detail View */
            <div className="space-y-6">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h2 className="text-xl font-bold text-gray-900">{selectedDetail.name}</h2>
                  <LocationBreadcrumb breadcrumb={selectedDetail.breadcrumb} className="mt-1" />
                </div>
                <span className="text-xs px-3 py-1 rounded-md neu-inset font-mono text-gray-500 font-bold">
                  {selectedDetail.type}
                </span>
              </div>

              <div className="border-t border-b py-4 space-y-3">
                <div className="flex justify-between items-center pr-4">
                  <div>
                    <span className="text-xs text-gray-500 uppercase font-medium">Status</span>
                    <p className="text-sm font-medium text-gray-900">
                      {selectedDetail.is_active ? 'Active' : 'Archived'}
                    </p>
                  </div>
                  {isStudentOrAbove && (
                    <div className="flex flex-col gap-1">
                      <label className="text-xs text-gray-500 uppercase font-medium">Location Access</label>
                      <select
                        value={selectedDetail.status}
                        onChange={(e) => handleStatusChange(e.target.value as LocationStatus)}
                        disabled={statusLoading}
                        className="text-sm rounded-xl px-3 py-2 neu-inset outline-none font-medium text-gray-700 bg-transparent"
                      >
                        {Object.values(LocationStatus).map(s => (
                          <option key={s} value={s}>{s.toUpperCase()}</option>
                        ))}
                      </select>
                    </div>
                  )}
                </div>
                <div>
                  <span className="text-xs text-gray-500 uppercase font-medium">Description</span>
                  <p className="text-sm text-gray-800">
                    {selectedDetail.description || 'No description provided.'}
                  </p>
                </div>
              </div>

              {/* Stores Manager Action Controls */}
              {isStoresManager && (
                <div className="flex flex-wrap items-center gap-3 pt-2">
                  <button
                    type="button"
                    onClick={handleStartEdit}
                    className="neu-button px-4 py-2 text-sm font-bold text-gray-500 hover:text-gray-700 transition-all rounded-xl"
                  >
                    Edit Details
                  </button>
                  <button
                    type="button"
                    onClick={() => handleStartCreate(selectedDetail.id)}
                    className="neu-button px-4 py-2 text-sm font-bold text-blue-600 transition-all rounded-xl"
                  >
                    + Add Child Location
                  </button>
                  {selectedDetail.is_active && (
                    <button
                      type="button"
                      onClick={() => {
                        setArchiveError(null);
                        setShowArchiveModal(true);
                      }}
                      className="neu-button px-4 py-2 text-sm font-bold text-red-600 transition-all rounded-xl"
                    >
                      Archive Location
                    </button>
                  )}
                </div>
              )}
            </div>
          ) : (
            /* Empty state on right panel */
            <div className="py-16 text-center text-gray-500 space-y-2">
              <p className="text-base font-medium text-gray-700">Select a location from the tree</p>
              <p className="text-sm">Click on any location to view its hierarchy details and actions.</p>
            </div>
          )}
        </div>
      </div>

      {/* Confirm Archive Dialog (UI/UX Spec §2.2 / §9 pattern) */}
      {showArchiveModal && selectedDetail && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md neu-flat rounded-2xl p-6 space-y-4">
            <h3 className="text-lg font-bold text-gray-700">Archive Location</h3>
            <p className="text-sm text-gray-500 font-medium">
              Archive <strong className="text-gray-700">{selectedDetail.name}</strong>? This location will no longer be available
              for new check-outs or transfers. This can be undone by a stores manager.
            </p>

            {archiveError && (
              <div role="alert" className="rounded-xl p-3 text-sm neu-inset text-red-600 font-medium">
                {archiveError}
              </div>
            )}

            <div className="flex items-center justify-end gap-3 pt-4 border-t border-gray-200/50">
              <button
                type="button"
                onClick={() => setShowArchiveModal(false)}
                className="neu-button px-4 py-2 text-sm font-bold text-gray-500 hover:text-gray-700 transition-all"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={archiving}
                onClick={handleArchiveConfirm}
                className="neu-button px-4 py-2 text-sm font-bold text-red-600 transition-all disabled:opacity-60"
              >
                {archiving ? 'Archiving…' : 'Archive Location'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
