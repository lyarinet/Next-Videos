import { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Shield, Save, LogOut, ArrowLeft } from 'lucide-react';
import { toast } from 'sonner';

const API_BASE_URL = import.meta.env.VITE_API_URL || '/api';

export default function Admin() {
  const [token, setToken] = useState<string | null>(localStorage.getItem('adminToken'));
  const [password, setPassword] = useState('');
  const [config, setConfig] = useState<any>({
    siteTitle: '',
    heroPrimaryText: '',
    heroSecondaryText: '',
    footerText: '',
  });
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    fetchConfig();
  }, [token]);

  const fetchConfig = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/config`);
      const data = await res.json();
      if (!data.error) {
        setConfig(data);
      }
    } catch (e) {
      console.error('Failed to load config');
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch(`${API_BASE_URL}/admin/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password })
      });
      const data = await res.json();
      
      if (res.ok && data.token) {
        localStorage.setItem('adminToken', data.token);
        setToken(data.token);
        toast.success('Logged in successfully');
      } else {
        toast.error(data.error || 'Login failed');
      }
    } catch (err) {
      toast.error('Network error during login');
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('adminToken');
    setToken(null);
    toast.info('Logged out');
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;
    
    setIsSaving(true);
    try {
      const res = await fetch(`${API_BASE_URL}/admin/config`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}` 
        },
        body: JSON.stringify(config)
      });
      
      if (res.ok) {
        toast.success('Configuration saved successfully! Refresh the home page to see changes.');
      } else {
        const data = await res.json();
        if (res.status === 401) {
          handleLogout();
          toast.error('Session expired');
        } else {
          toast.error(data.error || 'Failed to save config');
        }
      }
    } catch (err) {
      toast.error('Network error during save');
    } finally {
      setIsSaving(false);
    }
  };

  if (!token) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center px-4 text-white">
        <Card className="bg-slate-900 border-white/10" style={{ width: '100%', maxWidth: '400px' }}>
          <CardContent className="pt-6">
            <div className="flex flex-col items-center mb-6">
              <div className="w-12 h-12 rounded-full bg-red-500/20 flex items-center justify-center mb-4">
                <Shield className="w-6 h-6 text-red-500" />
              </div>
              <h1 className="text-2xl font-bold text-white">Admin Login</h1>
            </div>
            
            <form onSubmit={handleLogin} className="space-y-4">
              <div>
                <Input
                  type="password"
                  placeholder="Enter admin password..."
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="bg-white/5 border-white/10 text-white placeholder:text-gray-500"
                  required
                />
              </div>
              <Button type="submit" className="w-full bg-red-500 hover:bg-red-600 text-white font-semibold">
                Login
              </Button>
            </form>
            <div className="mt-4 text-center">
              <a href="#/" className="text-sm text-gray-500 hover:text-white flex items-center justify-center gap-1">
                <ArrowLeft className="w-4 h-4" /> Back to Site
              </a>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 text-white p-4 sm:p-8">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold bg-gradient-to-r from-red-400 to-orange-400 bg-clip-text text-transparent">
              Site Configuration
            </h1>
            <p className="text-gray-400">Manage global website settings and text</p>
          </div>
          <div className="flex gap-3">
            <Button variant="outline" className="border-white/10 bg-white/5 text-white hover:bg-white/10" onClick={() => window.location.hash = '#/'}>
              View Site
            </Button>
            <Button variant="outline" className="border-red-500/50 bg-red-500/10 text-red-400 hover:bg-red-500/20 hover:text-red-300" onClick={handleLogout}>
              <LogOut className="w-4 h-4 mr-2" />
              Logout
            </Button>
          </div>
        </div>

        <Card className="bg-slate-900/50 border-white/10 backdrop-blur-xl" style={{ width: '100%', maxWidth: '896px', margin: '0 auto' }}>
          <CardContent className="p-6">
            <form onSubmit={handleSave} className="space-y-6">
              
              <div className="space-y-4 shadow-sm p-4 bg-white/5 rounded-xl border border-white/5">
                <h3 className="text-lg font-semibold text-white border-b border-white/10 pb-2">Header / Branding</h3>
                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-1">Brand Name / Site Title</label>
                  <Input 
                    value={config.siteTitle || ''} 
                    onChange={e => setConfig({...config, siteTitle: e.target.value})}
                    className="bg-slate-950 border-white/10 text-white"
                  />
                  <p className="text-xs text-gray-500 mt-1">Appears in the header logo space and browser title.</p>
                </div>
              </div>

              <div className="space-y-4 shadow-sm p-4 bg-white/5 rounded-xl border border-white/5">
                <h3 className="text-lg font-semibold text-white border-b border-white/10 pb-2">Hero Section</h3>
                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-1">Primary Headline</label>
                  <Input 
                    value={config.heroPrimaryText || ''} 
                    onChange={e => setConfig({...config, heroPrimaryText: e.target.value})}
                    className="bg-slate-950 border-white/10 text-white"
                  />
                  <p className="text-xs text-gray-500 mt-1">Leave the word "Any Platform" or similar out if you want to keep the colored gradient suffix.</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-1">Secondary Subtitle</label>
                  <textarea 
                    value={config.heroSecondaryText || ''} 
                    onChange={e => setConfig({...config, heroSecondaryText: e.target.value})}
                    className="w-full flex min-h-[80px] rounded-md border border-white/10 bg-slate-950 px-3 py-2 text-sm text-white placeholder:text-gray-500 outline-none focus:ring-2 focus:ring-red-500/50 resize-y"
                  />
                </div>
              </div>

              <div className="space-y-4 shadow-sm p-4 bg-white/5 rounded-xl border border-white/5">
                <h3 className="text-lg font-semibold text-white border-b border-white/10 pb-2">Footer</h3>
                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-1">Footer Copyright Text</label>
                  <Input 
                    value={config.footerText || ''} 
                    onChange={e => setConfig({...config, footerText: e.target.value})}
                    className="bg-slate-950 border-white/10 text-white"
                  />
                </div>
              </div>

              <div className="pt-4 flex justify-end">
                <Button type="submit" disabled={isSaving} className="bg-gradient-to-r from-red-500 to-orange-500 hover:from-red-600 hover:to-orange-600 text-white px-8">
                  <Save className="w-4 h-4 mr-2" />
                  {isSaving ? 'Saving...' : 'Save Configuration'}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
