'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Dialog } from '@/components/ui/dialog';
import { Spinner } from '@/components/ui/loading-indicator';
import {
  Shield,
  ShieldAlert,
  ShieldCheck,
  AlertTriangle,
  Lock,
  LogOut,
  RefreshCw,
  Search,
  Filter,
  CheckCircle2,
  Ban,
  Clock,
  FileText,
} from 'lucide-react';
import type {
  AdminRole,
  ReportRecord,
  ModerationActionAudit,
  AdminStatsResponse,
  ModerationActionType,
} from '@zoopie/shared';

const ADMIN_STORAGE_KEY = 'zoopie_admin_auth_v1';

export default function AdminModerationPage() {
  // Authentication state
  const [adminKey, setAdminKey] = useState('');
  const [selectedRole, setSelectedRole] = useState<AdminRole>('MODERATOR');
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);
  const [auth, setAuth] = useState<{
    adminId: string;
    role: AdminRole;
    token: string;
    expiresAt: number;
  } | null>(null);

  // Dashboard Data State
  const [activeTab, setActiveTab] = useState<'reports' | 'audit'>('reports');
  const [reports, setReports] = useState<ReportRecord[]>([]);
  const [auditLogs, setAuditLogs] = useState<ModerationActionAudit[]>([]);
  const [stats, setStats] = useState<AdminStatsResponse | null>(null);
  const [isLoadingData, setIsLoadingData] = useState(false);

  // Filters
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [categoryFilter, setCategoryFilter] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState('');

  // Action Modal State
  const [inspectingReport, setInspectingReport] = useState<ReportRecord | null>(null);
  const [actionType, setActionType] = useState<ModerationActionType>('PERMANENT_BAN');
  const [actionReason, setActionReason] = useState('');
  const [isTakingAction, setIsTakingAction] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);

  const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

  // Restore stored session
  useEffect(() => {
    try {
      const stored = sessionStorage.getItem(ADMIN_STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (parsed.expiresAt * 1000 > Date.now()) {
          setAuth(parsed);
        } else {
          sessionStorage.removeItem(ADMIN_STORAGE_KEY);
        }
      }
    } catch {
      // Storage parsing failure fallback
    }
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!adminKey) return;
    setIsLoggingIn(true);
    setLoginError(null);

    try {
      const res = await fetch(`${apiUrl}/api/admin/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          adminKey,
          role: selectedRole,
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err?.error?.message || 'Invalid administrator security key');
      }

      const data = await res.json();
      setAuth(data);
      sessionStorage.setItem(ADMIN_STORAGE_KEY, JSON.stringify(data));
      setAdminKey('');
    } catch (err) {
      setLoginError(err instanceof Error ? err.message : 'Authentication failed');
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleLogout = () => {
    setAuth(null);
    sessionStorage.removeItem(ADMIN_STORAGE_KEY);
  };

  const fetchDashboardData = useCallback(async () => {
    if (!auth?.token) return;
    setIsLoadingData(true);

    try {
      const headers = { Authorization: `Bearer ${auth.token}` };

      // 1. Fetch Stats
      const statsRes = await fetch(`${apiUrl}/api/admin/stats`, { headers });
      if (statsRes.ok) {
        const statsData = await statsRes.json();
        setStats(statsData);
      }

      // 2. Fetch Reports
      const reportsRes = await fetch(`${apiUrl}/api/admin/reports?limit=100`, { headers });
      if (reportsRes.ok) {
        const reportsData = await reportsRes.json();
        setReports(reportsData.reports || []);
      }

      // 3. Fetch Audit Logs
      const auditRes = await fetch(`${apiUrl}/api/admin/audit-logs`, { headers });
      if (auditRes.ok) {
        const auditData = await auditRes.json();
        setAuditLogs(auditData.auditLogs || []);
      }
    } catch (err) {
      console.error('Failed to load moderation data', err);
    } finally {
      setIsLoadingData(false);
    }
  }, [auth?.token, apiUrl]);

  useEffect(() => {
    if (auth?.token) {
      fetchDashboardData();
    }
  }, [auth?.token, fetchDashboardData]);

  const handleExecuteAction = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inspectingReport || !auth?.token) return;

    if (!actionReason.trim() || actionReason.trim().length < 3) {
      setActionError(
        'Please provide a descriptive reason for this moderation action (min 3 chars).'
      );
      return;
    }

    setIsTakingAction(true);
    setActionError(null);
    setActionSuccess(null);

    try {
      const res = await fetch(`${apiUrl}/api/admin/reports/${inspectingReport.id}/action`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${auth.token}`,
        },
        body: JSON.stringify({
          actionType,
          reason: actionReason.trim(),
          banDurationHours: actionType === 'TEMPORARY_BAN' ? 24 : undefined,
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err?.error?.message || 'Failed to execute moderation action');
      }

      setActionSuccess(`Action ${actionType} successfully enforced and recorded.`);
      setActionReason('');

      // Refresh data
      await fetchDashboardData();

      // Close modal after brief feedback
      setTimeout(() => {
        setInspectingReport(null);
        setActionSuccess(null);
      }, 1500);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Action execution failed');
    } finally {
      setIsTakingAction(false);
    }
  };

  // Filtered reports
  const filteredReports = reports.filter(r => {
    if (statusFilter !== 'ALL' && r.status !== statusFilter) return false;
    if (categoryFilter !== 'ALL' && r.category !== categoryFilter) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchId = r.id.toLowerCase().includes(q);
      const matchDetails = (r.details || '').toLowerCase().includes(q);
      const matchTarget = r.reportedFingerprint.toLowerCase().includes(q);
      return matchId || matchDetails || matchTarget;
    }
    return true;
  });

  // -------------------------------------------------------------
  // View 1: Admin Authentication Gate
  // -------------------------------------------------------------
  if (!auth) {
    return (
      <div className="min-h-[80vh] flex items-center justify-center px-4 py-12">
        <Card className="w-full max-w-md p-6 sm:p-8 space-y-6 bg-surface-900 border-surface-800 shadow-2xl">
          <div className="text-center space-y-2">
            <div className="w-12 h-12 rounded-xl bg-brand-500/10 text-brand-400 mx-auto flex items-center justify-center border border-brand-500/20">
              <Lock className="w-6 h-6" />
            </div>
            <h1 className="text-xl font-bold tracking-tight text-white">
              Zoopie Moderation Console
            </h1>
            <p className="text-xs text-surface-400">
              Restricted trust & safety portal for authorized staff and auditors.
            </p>
          </div>

          <form onSubmit={handleLogin} className="space-y-4">
            {loginError && (
              <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-xs text-red-300 flex gap-2 items-center">
                <AlertTriangle className="w-4 h-4 shrink-0 text-red-400" />
                <span>{loginError}</span>
              </div>
            )}

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-surface-300">Admin Security Key</label>
              <Input
                type="password"
                value={adminKey}
                onChange={e => setAdminKey(e.target.value)}
                placeholder="Enter ADMIN_SECRET_KEY..."
                className="text-xs"
                required
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-surface-300">Target Role</label>
              <select
                value={selectedRole}
                onChange={e => setSelectedRole(e.target.value as AdminRole)}
                className="w-full bg-surface-800 border border-surface-700 rounded-lg px-3 py-2 text-xs text-surface-200 focus:outline-none focus:border-brand-500 transition-colors"
              >
                <option value="MODERATOR">Moderator (Review reports & enforce actions)</option>
                <option value="AUDITOR">Auditor (Read-only inspection of reports & logs)</option>
                <option value="SUPERADMIN">Superadmin (Full administrative privileges)</option>
              </select>
              <p className="text-[11px] text-surface-500">
                Auditor sessions enforce least privilege with strictly read-only capabilities.
              </p>
            </div>

            <Button
              type="submit"
              variant="brand"
              className="w-full gap-2 text-xs py-2.5 font-medium"
              disabled={isLoggingIn}
            >
              {isLoggingIn ? <Spinner size="sm" /> : <ShieldCheck className="w-4 h-4" />}
              <span>{isLoggingIn ? 'Verifying Credentials...' : 'Authenticate Console'}</span>
            </Button>
          </form>

          <div className="pt-2 border-t border-surface-800/80 text-center">
            <span className="text-[11px] text-surface-500">
              All access attempts are cryptographically verified and recorded in security logs.
            </span>
          </div>
        </Card>
      </div>
    );
  }

  // -------------------------------------------------------------
  // View 2: Authenticated Moderation Dashboard
  // -------------------------------------------------------------
  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8 space-y-6">
      {/* Header bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-surface-800">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-white flex items-center gap-2">
              <Shield className="w-6 h-6 text-brand-400" />
              <span>Trust & Safety Console</span>
            </h1>
            <Badge
              variant={
                auth.role === 'SUPERADMIN'
                  ? 'brand'
                  : auth.role === 'MODERATOR'
                    ? 'teal'
                    : 'outline'
              }
              size="sm"
            >
              {auth.role}
            </Badge>
          </div>
          <p className="text-xs text-surface-400 mt-1">
            Logged in as <code className="text-surface-300">{auth.adminId}</code> | Token active
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={fetchDashboardData}
            disabled={isLoadingData}
            className="text-xs gap-1.5"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoadingData ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleLogout}
            className="text-xs gap-1.5 text-surface-400 hover:text-white"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Sign Out</span>
          </Button>
        </div>
      </div>

      {/* KPI Overview Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="p-4 bg-surface-900 border-surface-800 space-y-1">
          <span className="text-xs text-surface-400">Pending Review</span>
          <div className="text-2xl font-bold text-amber-400">{stats?.pendingReports ?? 0}</div>
          <span className="text-[11px] text-surface-500">Requires review</span>
        </Card>
        <Card className="p-4 bg-surface-900 border-surface-800 space-y-1">
          <span className="text-xs text-surface-400">Under Review</span>
          <div className="text-2xl font-bold text-brand-400">{stats?.underReviewReports ?? 0}</div>
          <span className="text-[11px] text-surface-500">In investigation</span>
        </Card>
        <Card className="p-4 bg-surface-900 border-surface-800 space-y-1">
          <span className="text-xs text-surface-400">Resolved Reports</span>
          <div className="text-2xl font-bold text-emerald-400">{stats?.resolvedReports ?? 0}</div>
          <span className="text-[11px] text-surface-500">Processed</span>
        </Card>
        <Card className="p-4 bg-surface-900 border-surface-800 space-y-1">
          <span className="text-xs text-surface-400">Active Bans</span>
          <div className="text-2xl font-bold text-coral-400">{stats?.activeBans ?? 0}</div>
          <span className="text-[11px] text-surface-500">Suspended sessions</span>
        </Card>
      </div>

      {/* Tab Navigation */}
      <div className="flex border-b border-surface-800 gap-4">
        <button
          type="button"
          onClick={() => setActiveTab('reports')}
          className={`pb-3 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 ${
            activeTab === 'reports'
              ? 'border-brand-500 text-brand-400'
              : 'border-transparent text-surface-400 hover:text-white'
          }`}
        >
          <AlertTriangle className="w-4 h-4" />
          <span>Abuse Reports ({reports.length})</span>
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('audit')}
          className={`pb-3 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 ${
            activeTab === 'audit'
              ? 'border-brand-500 text-brand-400'
              : 'border-transparent text-surface-400 hover:text-white'
          }`}
        >
          <FileText className="w-4 h-4" />
          <span>Audit Trail ({auditLogs.length})</span>
        </button>
      </div>

      {/* ---------------- Tab 1: Abuse Reports Queue ---------------- */}
      {activeTab === 'reports' && (
        <div className="space-y-4">
          {/* Filter Bar */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs text-surface-400 flex items-center gap-1">
                <Filter className="w-3.5 h-3.5" /> Filter:
              </span>
              {['ALL', 'PENDING', 'UNDER_REVIEW', 'RESOLVED', 'DISMISSED'].map(status => (
                <button
                  key={status}
                  type="button"
                  onClick={() => setStatusFilter(status)}
                  className={`px-2.5 py-1 rounded-full text-xs font-medium transition-colors ${
                    statusFilter === status
                      ? 'bg-brand-500 text-white'
                      : 'bg-surface-800 text-surface-400 hover:bg-surface-700'
                  }`}
                >
                  {status}
                </button>
              ))}
            </div>

            <div className="flex items-center gap-2">
              <select
                value={categoryFilter}
                onChange={e => setCategoryFilter(e.target.value)}
                className="bg-surface-800 border border-surface-700 rounded-lg px-2.5 py-1 text-xs text-surface-300 focus:outline-none"
              >
                <option value="ALL">All Categories</option>
                <option value="HARASSMENT">Harassment</option>
                <option value="INAPPROPRIATE_CONTENT">Inappropriate Content</option>
                <option value="THREATS_OR_VIOLENCE">Threats & Violence</option>
                <option value="HATE_SPEECH">Hate Speech</option>
                <option value="SPAM_OR_BOT">Spam / Bot</option>
                <option value="IMPERSONATION">Impersonation</option>
                <option value="OTHER">Other</option>
              </select>

              <div className="relative">
                <Search className="w-3.5 h-3.5 text-surface-500 absolute left-2.5 top-2.5" />
                <Input
                  type="text"
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  placeholder="Search ID or details..."
                  className="pl-8 text-xs h-8 w-44"
                />
              </div>
            </div>
          </div>

          {/* Reports Table */}
          {filteredReports.length === 0 ? (
            <Card className="p-8 text-center bg-surface-900 border-surface-800 space-y-2">
              <CheckCircle2 className="w-8 h-8 text-emerald-400 mx-auto" />
              <h3 className="text-sm font-semibold text-white">Queue Empty</h3>
              <p className="text-xs text-surface-400">No reports matching the selected filters.</p>
            </Card>
          ) : (
            <div className="overflow-x-auto rounded-lg border border-surface-800">
              <table className="w-full text-left text-xs text-surface-300">
                <thead className="bg-surface-850 text-surface-400 uppercase text-[10px] tracking-wider border-b border-surface-800">
                  <tr>
                    <th className="px-4 py-3">Report ID</th>
                    <th className="px-4 py-3">Category</th>
                    <th className="px-4 py-3">Reported Peer</th>
                    <th className="px-4 py-3">Details</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3">Timestamp</th>
                    <th className="px-4 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-surface-800 bg-surface-900">
                  {filteredReports.map(report => (
                    <tr key={report.id} className="hover:bg-surface-850/50 transition-colors">
                      <td className="px-4 py-3 font-mono text-[11px] text-surface-400">
                        {report.id.slice(0, 8)}...
                      </td>
                      <td className="px-4 py-3 font-medium text-white">
                        <span className="px-2 py-0.5 rounded bg-surface-800 border border-surface-700 text-[11px]">
                          {report.category}
                        </span>
                      </td>
                      <td className="px-4 py-3 font-mono text-[11px] text-surface-400">
                        {report.reportedFingerprint.slice(0, 10)}...
                      </td>
                      <td className="px-4 py-3 max-w-xs truncate text-surface-300">
                        {report.details || <span className="italic text-surface-500">None</span>}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                            report.status === 'PENDING'
                              ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                              : report.status === 'UNDER_REVIEW'
                                ? 'bg-blue-500/10 text-blue-400 border border-blue-500/20'
                                : report.status === 'RESOLVED' || report.status === 'ACTION_TAKEN'
                                  ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                                  : 'bg-surface-700 text-surface-400'
                          }`}
                        >
                          {report.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-surface-400">
                        {new Date(report.createdAt).toLocaleTimeString()}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setInspectingReport(report);
                            setActionType('PERMANENT_BAN');
                            setActionReason('');
                            setActionError(null);
                            setActionSuccess(null);
                          }}
                          className="text-xs h-7 px-2.5"
                        >
                          Review
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ---------------- Tab 2: Audit Trail ---------------- */}
      {activeTab === 'audit' && (
        <div className="space-y-4">
          {auditLogs.length === 0 ? (
            <Card className="p-8 text-center bg-surface-900 border-surface-800 space-y-2">
              <Clock className="w-8 h-8 text-surface-500 mx-auto" />
              <h3 className="text-sm font-semibold text-white">No Audit Records Yet</h3>
              <p className="text-xs text-surface-400">
                All moderation enforcement decisions will be permanently logged here.
              </p>
            </Card>
          ) : (
            <div className="overflow-x-auto rounded-lg border border-surface-800">
              <table className="w-full text-left text-xs text-surface-300">
                <thead className="bg-surface-850 text-surface-400 uppercase text-[10px] tracking-wider border-b border-surface-800">
                  <tr>
                    <th className="px-4 py-3">Timestamp</th>
                    <th className="px-4 py-3">Action Type</th>
                    <th className="px-4 py-3">Target Participant</th>
                    <th className="px-4 py-3">Reason</th>
                    <th className="px-4 py-3">Admin</th>
                    <th className="px-4 py-3">Expires At</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-surface-800 bg-surface-900">
                  {auditLogs.map(log => (
                    <tr key={log.id} className="hover:bg-surface-850/50 transition-colors">
                      <td className="px-4 py-3 text-surface-400">
                        {new Date(log.createdAt).toLocaleString()}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`px-2 py-0.5 rounded font-semibold text-[10px] ${
                            log.actionType === 'PERMANENT_BAN' || log.actionType === 'TEMPORARY_BAN'
                              ? 'bg-red-500/10 text-red-400 border border-red-500/20'
                              : log.actionType === 'WARNING'
                                ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                                : 'bg-surface-700 text-surface-300'
                          }`}
                        >
                          {log.actionType}
                        </span>
                      </td>
                      <td className="px-4 py-3 font-mono text-[11px] text-surface-400">
                        {log.targetFingerprint.slice(0, 12)}...
                      </td>
                      <td className="px-4 py-3 text-surface-200">{log.reason}</td>
                      <td className="px-4 py-3 font-mono text-[11px] text-brand-400">
                        {log.adminId}
                      </td>
                      <td className="px-4 py-3 text-surface-500">
                        {log.expiresAt ? new Date(log.expiresAt).toLocaleString() : 'Permanent'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Review & Action Modal */}
      {inspectingReport && (
        <Dialog
          isOpen={Boolean(inspectingReport)}
          onClose={() => setInspectingReport(null)}
          title={`Review Report: ${inspectingReport.category}`}
          description={`Report ID: ${inspectingReport.id}`}
          size="lg"
        >
          <div className="space-y-4 py-1 text-xs text-surface-300">
            {/* Metadata Summary */}
            <div className="p-3 rounded-lg bg-surface-900 border border-surface-800 space-y-1.5">
              <div className="flex justify-between">
                <span className="text-surface-500">Target Session / Fingerprint:</span>
                <span className="font-mono text-surface-200">
                  {inspectingReport.reportedFingerprint}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-surface-500">Reporter Session:</span>
                <span className="font-mono text-surface-400">
                  {inspectingReport.reporterSessionId}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-surface-500">Reported Category:</span>
                <span className="font-semibold text-white">{inspectingReport.category}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-surface-500">Created:</span>
                <span>{new Date(inspectingReport.createdAt).toLocaleString()}</span>
              </div>
              {inspectingReport.details && (
                <div className="pt-2 border-t border-surface-800">
                  <span className="text-surface-500 block mb-1">Details provided:</span>
                  <p className="p-2 rounded bg-surface-950 text-surface-200 text-xs">
                    {inspectingReport.details}
                  </p>
                </div>
              )}
            </div>

            {/* Least Privilege Warning for Auditor */}
            {auth.role === 'AUDITOR' ? (
              <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/20 flex gap-2.5 items-center text-amber-300">
                <ShieldAlert className="w-4 h-4 shrink-0 text-amber-400" />
                <span>
                  <strong>Auditor Role:</strong> You have read-only inspection access. Action
                  execution is reserved for Moderators and Superadmins.
                </span>
              </div>
            ) : (
              <form onSubmit={handleExecuteAction} className="space-y-3 pt-2">
                {actionError && (
                  <div className="p-2.5 rounded bg-red-500/10 border border-red-500/20 text-red-300 text-xs">
                    {actionError}
                  </div>
                )}
                {actionSuccess && (
                  <div className="p-2.5 rounded bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 text-xs">
                    {actionSuccess}
                  </div>
                )}

                <div className="space-y-1">
                  <label className="text-xs font-medium text-surface-300">
                    Moderation Decision
                  </label>
                  <select
                    value={actionType}
                    onChange={e => setActionType(e.target.value as ModerationActionType)}
                    className="w-full bg-surface-900 border border-surface-800 rounded-lg px-3 py-2 text-xs text-surface-200 focus:outline-none focus:border-brand-500"
                  >
                    <option value="PERMANENT_BAN">
                      Permanent Ban (Terminate & blacklist session)
                    </option>
                    <option value="TEMPORARY_BAN">Temporary Ban (24 hours)</option>
                    <option value="SESSION_TERMINATION">Terminate Active Session Only</option>
                    <option value="WARNING">Issue Formal Warning</option>
                    <option value="DISMISS">Dismiss Report (No violation found)</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-medium text-surface-300">
                    Audit Log Reason <span className="text-red-400">*</span>
                  </label>
                  <textarea
                    rows={2}
                    value={actionReason}
                    onChange={e => setActionReason(e.target.value)}
                    placeholder="Enter reason for audit record (e.g., Confirmed hate speech in chat)..."
                    className="w-full bg-surface-900 border border-surface-800 rounded-lg p-2.5 text-xs text-surface-200 placeholder-surface-600 focus:outline-none focus:border-brand-500 resize-none"
                    required
                  />
                </div>

                <div className="flex justify-end gap-2 pt-2 border-t border-surface-800">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setInspectingReport(null)}
                    disabled={isTakingAction}
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    variant="destructive"
                    size="sm"
                    disabled={isTakingAction}
                    className="gap-1.5"
                  >
                    {isTakingAction ? <Spinner size="sm" /> : <Ban className="w-3.5 h-3.5" />}
                    <span>{isTakingAction ? 'Executing...' : 'Enforce Action'}</span>
                  </Button>
                </div>
              </form>
            )}
          </div>
        </Dialog>
      )}
    </div>
  );
}
