import React from 'react';

export const Security: React.FC = () => {
  return (
    <div className="p-8 max-w-5xl mx-auto space-y-6">
      {/* Page Header */}
      <div>
        <h2 className="text-xl font-bold text-slate-900 tracking-tight">Security</h2>
        <p className="text-xs text-slate-500 font-medium mt-0.5">
          Firewall rules, threat protection, and server security policies.
        </p>
      </div>

      {/* Web Application Firewall Section */}
      <div className="bg-white rounded-3xl border border-slate-200/80 shadow-card p-6 space-y-4">
        <div>
          <h3 className="text-sm font-bold text-slate-900">Web Application Firewall</h3>
        </div>
      </div>
    </div>
  );
};
