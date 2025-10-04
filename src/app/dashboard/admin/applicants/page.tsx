'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useRefreshSession } from '@/lib/hooks/useRefreshSession';

interface Applicant {
  id: string;
  name: string;
  email: string;
  createdAt: string;
}

export default function ApplicantsPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const { refreshSession } = useRefreshSession();
  const [applicants, setApplicants] = useState<Applicant[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [processingId, setProcessingId] = useState<string | null>(null);
  
  // Fetch applicants on page load
  useEffect(() => {
    const fetchApplicants = async () => {
      try {
        const response = await fetch('/api/admin/applicants');
        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(errorData.error || 'Failed to fetch applicants');
        }
        
        const data = await response.json();
        setApplicants(data.applicants || []);
      } catch (error) {
        console.error('Error loading applicants:', error);
        setError(error instanceof Error ? error.message : 'Failed to load applicants');
      } finally {
        setLoading(false);
      }
    };
    
    fetchApplicants();
  }, []);
  
  // Redirect non-admins
  useEffect(() => {
    if (status === 'authenticated' && session?.user?.role !== 'admin') {
      router.push('/dashboard');
    }
  }, [status, session, router]);
  
  const handleApprove = async (applicantId: string) => {
    setProcessingId(applicantId);
    try {
      const response = await fetch('/api/admin/approve-applicant', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ userId: applicantId }),
      });
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Failed to approve applicant');
      }
      
      // Remove the approved applicant from the list
      setApplicants(prevApplicants => 
        prevApplicants.filter(applicant => applicant.id !== applicantId)
      );
      
      // Force refresh the user's session to get updated role if it changed
      await refreshSession();
    } catch (error) {
      console.error('Error approving applicant:', error);
      alert(error instanceof Error ? error.message : 'Failed to approve applicant');
    } finally {
      setProcessingId(null);
    }
  };
  
  if (loading) {
    return (
      <div className="p-6">
        <h1 className="text-2xl font-bold mb-6">Applicants</h1>
        <div className="animate-pulse">
          <div className="h-12 bg-gray-200 rounded mb-4"></div>
          <div className="h-12 bg-gray-200 rounded mb-4"></div>
          <div className="h-12 bg-gray-200 rounded"></div>
        </div>
      </div>
    );
  }
  
  if (error) {
    return (
      <div className="p-6">
        <h1 className="text-2xl font-bold mb-6">Applicants</h1>
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
          <p>{error}</p>
        </div>
      </div>
    );
  }
  
  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-6">Manage Applicants</h1>
      
      {applicants.length === 0 ? (
        <div className="bg-white shadow rounded-lg p-6 text-center">
          <p className="text-gray-500">No pending applicants found.</p>
        </div>
      ) : (
        <div className="bg-white shadow rounded-lg overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Name</th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Email</th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Applied On</th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {applicants.map((applicant) => (
                <tr key={applicant.id}>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="font-medium text-gray-900">{applicant.name}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-500">{applicant.email}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-500">
                      {new Date(applicant.createdAt).toLocaleDateString()}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm">
                    <button
                      onClick={() => handleApprove(applicant.id)}
                      disabled={processingId === applicant.id}
                      className="bg-green-600 hover:bg-green-700 text-white font-medium py-1.5 px-3 rounded text-sm disabled:opacity-50"
                    >
                      {processingId === applicant.id ? 'Processing...' : 'Approve'}
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