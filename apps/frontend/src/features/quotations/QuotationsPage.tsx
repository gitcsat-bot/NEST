import { useState, useEffect, FormEvent } from 'react';
import { apiRequest } from '../../api-client/client';
import { useAuth } from '../../app/AuthContext';
import { UserRole, roleAtLeast } from '@nest/shared-types';

export function QuotationsPage() {
  const { user } = useAuth();
  const [quotations, setQuotations] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [newQuote, setNewQuote] = useState({ name: '', tenderType: '', amount: 0, validTill: '' });
  const [file, setFile] = useState<File | null>(null);

  const isAdmin = user && roleAtLeast(user.role as UserRole, UserRole.STORES_MANAGER);

  async function fetchQuotations() {
    setLoading(true);
    try {
      const data = await apiRequest<any[]>('/quotations');
      setQuotations(data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchQuotations();
  }, []);

  async function handleAddSubmit(e: FormEvent) {
    e.preventDefault();
    try {
      const formData = new FormData();
      formData.append('name', newQuote.name);
      formData.append('tenderType', newQuote.tenderType);
      formData.append('amount', newQuote.amount.toString());
      if (newQuote.validTill) {
        formData.append('validTill', newQuote.validTill);
      }
      if (file) {
        formData.append('pdf', file);
      }

      await apiRequest('/quotations', {
        method: 'POST',
        body: formData
      });
      setShowAdd(false);
      fetchQuotations();
    } catch (e) {
      console.error(e);
    }
  }

  async function deleteQuotation(id: string) {
    if (!confirm('Are you sure you want to delete this quotation?')) return;
    try {
      await apiRequest(`/quotations/${id}`, { method: 'DELETE' });
      fetchQuotations();
    } catch (e) {
      console.error(e);
    }
  }

  async function updateStatus(id: string, status: string) {
    try {
      await apiRequest(`/quotations/${id}/status`, { method: 'PATCH', body: { status } });
      fetchQuotations();
    } catch (e) {
      console.error(e);
    }
  }

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto">
      <div className="flex flex-col md:flex-row md:items-center justify-between mb-8 gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-700 mb-2">Quotations</h1>
          <p className="text-sm font-medium text-gray-600">Track and manage vendor quotations and tenders.</p>
        </div>
        {isAdmin && (
          <button onClick={() => setShowAdd(true)} className="neu-button px-6 py-2.5 rounded-xl text-sm font-bold text-blue-600 transition-all">
            + Add Quotation
          </button>
        )}
      </div>

      {showAdd && (
        <div className="neu-flat rounded-xl p-6 mb-8">
          <h2 className="text-xl font-bold mb-6 text-gray-700 border-b border-gray-200/50 pb-4">New Quotation</h2>
          <form onSubmit={handleAddSubmit} className="flex flex-col gap-6 max-w-md">
            <div>
              <label className="block text-sm font-bold mb-2 text-gray-600 pl-1">Name</label>
              <input required value={newQuote.name} onChange={e => setNewQuote(p => ({ ...p, name: e.target.value }))} className="neu-inset w-full px-4 py-3.5 rounded-xl outline-none font-medium text-gray-700" placeholder="e.g. Server Racks Q3" />
            </div>
            <div>
              <label className="block text-sm font-bold mb-2 text-gray-600 pl-1">Tender Type</label>
              <select required value={newQuote.tenderType} onChange={e => setNewQuote(p => ({ ...p, tenderType: e.target.value }))} className="neu-inset w-full px-4 py-3.5 rounded-xl outline-none bg-transparent appearance-none font-medium text-gray-700">
                <option value="">Select tender type</option>
                <option value="Open">Open</option>
                <option value="Restricted">Restricted</option>
                <option value="Negotiated">Negotiated</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-bold mb-2 text-gray-600 pl-1">Amount ($)</label>
              <input type="number" step="0.01" required value={newQuote.amount} onChange={e => setNewQuote(p => ({ ...p, amount: Number(e.target.value) }))} className="neu-inset w-full px-4 py-3.5 rounded-xl outline-none font-medium text-gray-700" />
            </div>
            <div>
              <label className="block text-sm font-bold mb-2 text-gray-600 pl-1">Valid Till</label>
              <input type="date" value={newQuote.validTill} onChange={e => setNewQuote(p => ({ ...p, validTill: e.target.value }))} className="neu-inset w-full px-4 py-3.5 rounded-xl outline-none font-medium text-gray-700" />
            </div>
            <div>
              <label className="block text-sm font-bold mb-2 text-gray-600 pl-1">PDF Document</label>
              <input type="file" accept="application/pdf" onChange={e => setFile(e.target.files?.[0] || null)} className="neu-inset w-full px-4 py-3.5 rounded-xl outline-none font-medium text-gray-700 file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-sm file:font-bold file:neu-button file:text-blue-600 hover:file:text-blue-700" />
            </div>
            <div className="flex gap-4 mt-4">
              <button type="submit" className="neu-button flex-1 rounded-xl py-3 font-bold text-blue-600 transition-all">Save</button>
              <button type="button" onClick={() => setShowAdd(false)} className="neu-button flex-1 rounded-xl py-3 font-bold text-gray-600 transition-all">Cancel</button>
            </div>
          </form>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {loading ? <p className="text-gray-500 font-medium text-sm">Loading...</p> : quotations.length === 0 ? <p className="text-gray-500 font-medium text-sm">No quotations found.</p> : quotations.map(q => (
          <div key={q.id} className="neu-flat rounded-xl p-6 flex flex-col justify-between">
            <div>
              <div className="flex justify-between items-start mb-4 border-b border-gray-200/50 pb-4">
                <div className="overflow-hidden">
                  <h3 className="font-bold text-gray-700 text-lg truncate">{q.name}</h3>
                  <p className="text-xs text-gray-500 font-medium mt-1 truncate">By {q.createdBy?.displayName} on {new Date(q.createdAt).toLocaleDateString()}</p>
                </div>
                <span className={`inline-block px-3 py-1 rounded-full text-xs font-bold shadow-inner flex-shrink-0 ml-2 ${
                  q.status === 'approved' ? 'bg-emerald-100 text-emerald-800' : 
                  q.status === 'rejected' ? 'bg-red-100 text-red-800' : 
                  'bg-yellow-100 text-yellow-800'
                }`}>
                  {q.status}
                </span>
              </div>
              
              <div className="space-y-3 mb-6 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-500 font-medium">Tender</span>
                  <span className="font-medium text-gray-700">{q.tenderType}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500 font-medium">Amount</span>
                  <span className="font-bold text-blue-600">${q.amount}</span>
                </div>
                {q.validTill && (
                  <div className="flex justify-between">
                    <span className="text-gray-500 font-medium">Valid Till</span>
                    <span className="font-medium text-red-600">{new Date(q.validTill).toLocaleDateString()}</span>
                  </div>
                )}
                {q.pdfUrl && (
                  <div className="flex justify-between items-center mt-2 pt-2 border-t border-gray-100">
                    <span className="text-gray-500 font-medium">Document</span>
                    <a href={`${import.meta.env.VITE_API_BASE_URL || '/api/v1'}${q.pdfUrl}`} target="_blank" rel="noopener noreferrer" className="neu-button px-3 py-1.5 rounded-lg text-xs font-bold text-blue-600">
                      View PDF
                    </a>
                  </div>
                )}
              </div>
            </div>
            
            {isAdmin && (
              <div className="flex gap-3 pt-4 border-t border-gray-200/50 mt-auto justify-end">
                <button onClick={() => deleteQuotation(q.id)} className="neu-button px-4 py-2 rounded-xl text-sm font-bold text-red-600 mr-auto">Delete</button>
                {q.status === 'pending' && (
                  <>
                    <button onClick={() => updateStatus(q.id, 'rejected')} className="neu-button px-4 py-2 rounded-xl text-sm font-bold text-gray-600">Reject</button>
                    <button onClick={() => updateStatus(q.id, 'approved')} className="neu-button px-4 py-2 rounded-xl text-sm font-bold text-emerald-600">Approve</button>
                  </>
                )}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
