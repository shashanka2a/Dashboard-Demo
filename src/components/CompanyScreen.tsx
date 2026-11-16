"use client";

import { useState, useEffect, useRef } from "react";
import { Upload, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { AppLogo } from "@/components/AppLogo";

type CompanySettings = {
  company_name: string;
  company_phone: string;
  company_email: string;
  cc_emails: string;
  industry: string;
  sub_industry: string;
  employee_range: string;
  search_address: string;
  street_address: string;
  city: string;
  state: string;
  zip_code: string;
  country: string;
  report_language: string;
  brand_color: string;
  logo_url: string | null;
  logo_public_id: string | null;
};

const DEFAULT_SETTINGS: CompanySettings = {
  company_name: "Wick'd Environmental Technologies",
  company_phone: '+1 (904) 796-7790',
  company_email: 'brad@wickd-fl.com',
  cc_emails: 'savannah@wickd-fl.com',
  industry: 'Construction',
  sub_industry: 'Environmental Services',
  employee_range: '10-50',
  search_address: '',
  street_address: '864 Southwest Spirit Avenue',
  city: 'Fort White',
  state: 'Florida',
  zip_code: '32038',
  country: 'United States',
  report_language: 'English',
  brand_color: '#FF6633',
  logo_url: null,
  logo_public_id: null,
};

export function CompanyScreen() {
  const [companyData, setCompanyData] = useState<CompanySettings>(DEFAULT_SETTINGS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [logoError, setLogoError] = useState('');
  const logoInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/company/settings', { cache: 'no-store' });
        const data = await res.json();
        if (!res.ok) throw new Error(data?.error || 'Failed to load company settings');
        if (!cancelled) setCompanyData({ ...DEFAULT_SETTINGS, ...data });
      } catch (e) {
        if (!cancelled) {
          toast.error(e instanceof Error ? e.message : 'Could not load company settings');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const handleChange = (field: keyof CompanySettings, value: string) => {
    setCompanyData((prev) => ({ ...prev, [field]: value }));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await fetch('/api/company/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(companyData),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || 'Save failed');
      setCompanyData({ ...DEFAULT_SETTINGS, ...data });
      toast.success('Company information saved.');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  const handleReset = () => {
    if (confirm('Reset all changes? Unsaved edits will be lost.')) {
      window.location.reload();
    }
  };

  const handleLogoFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

    setUploadingLogo(true);
    setLogoError('');
    try {
      const fd = new FormData();
      fd.append('file', file);
      const res = await fetch('/api/company/logo', { method: 'POST', body: fd });
      const raw = await res.text();
      let data: { error?: string; logo_url?: string | null; logo_public_id?: string | null };
      try {
        data = JSON.parse(raw) as typeof data;
      } catch {
        throw new Error(
          res.ok
            ? 'Invalid response from logo upload.'
            : `Logo upload failed (${res.status}). Check Cloudinary env vars on the server.`
        );
      }
      if (!res.ok) throw new Error(data?.error || 'Logo upload failed');

      setCompanyData((prev) => ({
        ...prev,
        logo_url: data.logo_url ?? null,
        logo_public_id: data.logo_public_id ?? null,
      }));
      toast.success('Logo uploaded and saved.');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Logo upload failed';
      setLogoError(message);
      toast.error(message);
    } finally {
      setUploadingLogo(false);
    }
  };

  return (
    <div className="h-full">
      <div data-tour="company-header" className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl">Company info</h1>
          <div className="flex items-center gap-3">
            <button className="text-sm text-gray-700 hover:text-black transition-colors">
              View report preview
            </button>
            <button
              type="button"
              onClick={handleReset}
              disabled={loading || saving || uploadingLogo}
              className="px-4 py-2 border border-gray-300 rounded text-sm hover:bg-gray-100 transition-colors disabled:opacity-50"
            >
              Reset
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={loading || saving || uploadingLogo}
              className="px-4 py-2 bg-[#FF6633] text-white rounded text-sm hover:bg-[#E55A2B] transition-colors disabled:opacity-50 inline-flex items-center gap-2"
            >
              {saving && <Loader2 className="w-4 h-4 animate-spin" />}
              Save
            </button>
          </div>
        </div>
      </div>

      <div className="p-6">
        <div data-tour="company-form" className="max-w-5xl mx-auto bg-white border border-gray-300 rounded-lg">
          <div className="flex">
            <div className="w-64 p-6 border-r border-gray-300">
              <div className="space-y-4">
                <div className="w-24 h-24 bg-white border-2 border-gray-300 rounded-lg flex items-center justify-center overflow-hidden">
                  {companyData.logo_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={companyData.logo_url}
                      alt="Company logo"
                      className="max-w-full max-h-full object-contain"
                    />
                  ) : (
                    <AppLogo size={64} roundedClassName="rounded-lg" />
                  )}
                </div>
                <input
                  ref={logoInputRef}
                  type="file"
                  accept="image/png,image/jpeg,image/jpg,image/gif,image/webp,image/svg+xml"
                  className="hidden"
                  onChange={handleLogoFile}
                />
                <button
                  type="button"
                  onClick={() => logoInputRef.current?.click()}
                  disabled={loading || uploadingLogo}
                  className="w-full flex items-center justify-center gap-2 px-3 py-2 border border-gray-300 rounded text-sm hover:bg-gray-100 transition-colors disabled:opacity-50"
                >
                  {uploadingLogo ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Upload className="w-4 h-4" />
                  )}
                  <span>{uploadingLogo ? 'Uploading…' : companyData.logo_url ? 'Change logo' : 'Upload logo'}</span>
                </button>
                {logoError ? (
                  <p className="text-xs text-red-600">{logoError}</p>
                ) : null}
                <p className="text-xs text-gray-500">PNG, JPG, or SVG · max 5 MB</p>
              </div>
            </div>

            <div className="flex-1 p-6">
              {loading ? (
                <div className="flex items-center justify-center py-16 text-gray-500 gap-2">
                  <Loader2 className="w-5 h-5 animate-spin text-[#FF6633]" />
                  Loading…
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-4">
                  <div className="col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-1">Company name</label>
                    <input
                      type="text"
                      value={companyData.company_name}
                      onChange={(e) => handleChange('company_name', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-[#FF6633] focus:border-transparent"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Company phone</label>
                    <input
                      type="text"
                      value={companyData.company_phone}
                      onChange={(e) => handleChange('company_phone', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-[#FF6633] focus:border-transparent"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Company email</label>
                    <input
                      type="email"
                      value={companyData.company_email}
                      onChange={(e) => handleChange('company_email', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-[#FF6633] focus:border-transparent"
                    />
                  </div>

                  <div className="col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-1">CC Emails</label>
                    <input
                      type="text"
                      value={companyData.cc_emails}
                      onChange={(e) => handleChange('cc_emails', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-[#FF6633] focus:border-transparent"
                      placeholder="Separate multiple emails with commas"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Industry</label>
                    <select
                      value={companyData.industry}
                      onChange={(e) => handleChange('industry', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-[#FF6633] focus:border-transparent"
                    >
                      <option>Construction</option>
                      <option>Environmental Services</option>
                      <option>Utilities</option>
                      <option>Infrastructure</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Sub industry</label>
                    <select
                      value={companyData.sub_industry}
                      onChange={(e) => handleChange('sub_industry', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-[#FF6633] focus:border-transparent"
                    >
                      <option>Environmental Services</option>
                      <option>Civil Engineering</option>
                      <option>Landscaping</option>
                      <option>General Contracting</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Employee range</label>
                    <select
                      value={companyData.employee_range}
                      onChange={(e) => handleChange('employee_range', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-[#FF6633] focus:border-transparent"
                    >
                      <option>1-10</option>
                      <option>10-50</option>
                      <option>50-100</option>
                      <option>100-500</option>
                      <option>500+</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Search address</label>
                    <input
                      type="text"
                      value={companyData.search_address}
                      onChange={(e) => handleChange('search_address', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-[#FF6633] focus:border-transparent"
                      placeholder="Search for address"
                    />
                  </div>

                  <div className="col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-1">Street address</label>
                    <input
                      type="text"
                      value={companyData.street_address}
                      onChange={(e) => handleChange('street_address', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-[#FF6633] focus:border-transparent"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">City</label>
                    <input
                      type="text"
                      value={companyData.city}
                      onChange={(e) => handleChange('city', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-[#FF6633] focus:border-transparent"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">State</label>
                    <input
                      type="text"
                      value={companyData.state}
                      onChange={(e) => handleChange('state', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-[#FF6633] focus:border-transparent"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">ZIP code</label>
                    <input
                      type="text"
                      value={companyData.zip_code}
                      onChange={(e) => handleChange('zip_code', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-[#FF6633] focus:border-transparent"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Country</label>
                    <input
                      type="text"
                      value={companyData.country}
                      onChange={(e) => handleChange('country', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-[#FF6633] focus:border-transparent"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Report display language</label>
                    <select
                      value={companyData.report_language}
                      onChange={(e) => handleChange('report_language', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-[#FF6633] focus:border-transparent"
                    >
                      <option>English</option>
                      <option>Spanish</option>
                      <option>French</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Brand color</label>
                    <div className="flex gap-2">
                      <input
                        type="color"
                        value={companyData.brand_color}
                        onChange={(e) => handleChange('brand_color', e.target.value)}
                        className="w-12 h-10 border border-gray-300 rounded cursor-pointer"
                      />
                      <input
                        type="text"
                        value={companyData.brand_color}
                        onChange={(e) => handleChange('brand_color', e.target.value)}
                        className="flex-1 px-3 py-2 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-[#FF6633] focus:border-transparent"
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
