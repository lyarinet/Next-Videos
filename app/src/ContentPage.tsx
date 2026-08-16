import { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Download } from 'lucide-react';

const API_BASE_URL = import.meta.env.VITE_API_URL || '/api';

interface ContentPageProps {
  title: string;
  field: string;
}

export default function ContentPage({ title, field }: ContentPageProps) {
  const [content, setContent] = useState('');
  const [siteTitle, setSiteTitle] = useState('Next-Videos');

  useEffect(() => {
    fetch(`${API_BASE_URL}/config`)
      .then(res => res.json())
      .then(data => {
        if (!data.error) {
          setContent(data[field] || '');
          setSiteTitle(data.siteTitle || 'Next-Videos');
        }
      })
      .catch(() => {});
  }, [field]);

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      {/* Header */}
      <header className="w-full py-4 px-4 sm:px-6 lg:px-8 border-b border-white/10">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2 cursor-pointer" onClick={() => window.location.hash = '#/'}>
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-red-500 to-orange-500 flex items-center justify-center">
              <Download className="w-5 h-5 text-white" />
            </div>
            <span className="text-xl font-bold bg-gradient-to-r from-white to-gray-400 bg-clip-text text-transparent">
              {siteTitle}
            </span>
          </div>
          <Button 
            variant="ghost" 
            className="text-gray-400 hover:text-white hover:bg-white/5"
            onClick={() => window.location.hash = '#/'}
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Home
          </Button>
        </div>
      </header>

      <main className="py-20 px-4">
        <div className="max-w-4xl mx-auto">
          <h1 className="text-4xl sm:text-5xl font-bold mb-12 bg-gradient-to-r from-red-400 to-orange-400 bg-clip-text text-transparent">
            {title}
          </h1>
          
          <Card className="bg-slate-900/50 border-white/10 backdrop-blur-xl">
            <CardContent className="p-8 sm:p-12">
              <div className="prose prose-invert max-w-none">
                {content.split('\n').map((line, i) => (
                  <p key={i} className="text-gray-300 leading-relaxed mb-4 whitespace-pre-wrap">
                    {line}
                  </p>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </main>

      {/* Footer */}
      <footer className="py-8 px-4 sm:px-6 lg:px-8 border-t border-white/10 mt-auto">
        <div className="max-w-6xl mx-auto text-center">
          <p className="text-sm text-gray-500">
            © 2026 {siteTitle}. All rights reserved.
          </p>
        </div>
      </footer>
    </div>
  );
}
