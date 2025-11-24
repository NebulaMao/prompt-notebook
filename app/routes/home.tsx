import { useState, useEffect } from "react";
import type { Route } from "./+types/home";
import { supabase, type Prompt, isSupabaseConfigured } from "../lib/supabase";
import { prompts as mockPrompts } from "../data/prompts";
import { Link } from "react-router";
import {
  Search,
  Copy,
  Check,
  Filter,
  Sparkles,
  Code,
  PenTool,
  Palette,
  Briefcase,
  MoreHorizontal,
  Heart,
  X,
  Sun,
  Moon,
  Monitor
} from "lucide-react";
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function meta({ }: Route.MetaArgs) {
  return [
    { title: "Prompt Notebook | Discover & Share AI Prompts" },
    { name: "description", content: "A curated collection of high-quality AI prompts for coding, writing, art, and more." },
    { name: "keywords", content: "AI prompts, ChatGPT prompts, Midjourney prompts, coding prompts, writing prompts, creative writing, productivity, art prompts" },
    { property: "og:title", content: "Prompt Notebook | Discover & Share AI Prompts" },
    { property: "og:description", content: "A curated collection of high-quality AI prompts for coding, writing, art, and more." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary_large_image" },
    { name: "twitter:title", content: "Prompt Notebook | Discover & Share AI Prompts" },
    { name: "twitter:description", content: "A curated collection of high-quality AI prompts for coding, writing, art, and more." },
  ];
}

const CATEGORIES = ['All', 'Coding', 'Writing', 'Art', 'Productivity', 'Other'];

export default function Home() {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("All");
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [selectedPrompt, setSelectedPrompt] = useState<Prompt | null>(null);
  const [theme, setTheme] = useState<'light' | 'dark' | 'system'>('system');
  const [prompts, setPrompts] = useState<Prompt[]>([]);
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<any>(null);
  const [likedPrompts, setLikedPrompts] = useState<Set<string>>(new Set());

  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const savedTheme = (localStorage.getItem('theme') as 'light' | 'dark' | 'system') || 'system';
    setTheme(savedTheme);
  }, []);

  useEffect(() => {
    localStorage.setItem('theme', theme);
    if (theme === 'system') {
      const systemTheme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
      document.documentElement.setAttribute('data-theme', systemTheme);

      const listener = (e: MediaQueryListEvent) => {
        document.documentElement.setAttribute('data-theme', e.matches ? 'dark' : 'light');
      };
      const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
      mediaQuery.addEventListener('change', listener);
      return () => mediaQuery.removeEventListener('change', listener);
    } else {
      document.documentElement.setAttribute('data-theme', theme);
    }
  }, [theme]);

  useEffect(() => {
    const liked = localStorage.getItem('likedPrompts');
    if (liked) {
      setLikedPrompts(new Set(JSON.parse(liked)));
    }
  }, []);

  useEffect(() => {
    // Fetch prompts from Supabase
    async function fetchPrompts() {
      setLoading(true);
      setError(null);

      // Check if Supabase is configured
      if (!isSupabaseConfigured()) {
        console.warn('Supabase not configured. Using mock data.');
        setPrompts(mockPrompts);
        setLoading(false);
        return;
      }

      const { data, error } = await supabase
        .from('prompts')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching prompts:', error);
        setError('Network error: Unable to connect to backend');
        setPrompts([]);
      } else {
        setPrompts(data || []);
      }
      setLoading(false);
    }

    fetchPrompts();

    // Check auth state (only if Supabase is configured)
    if (isSupabaseConfigured()) {
      supabase.auth.getSession().then(({ data: { session } }) => {
        setUser(session?.user ?? null);
      });

      const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
        setUser(session?.user ?? null);
      });

      return () => subscription.unsubscribe();
    }
  }, []);

  const filteredPrompts = prompts.filter((prompt) => {
    const matchesSearch =
      prompt.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      prompt.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
      prompt.tags.some(tag => tag.toLowerCase().includes(searchQuery.toLowerCase()));

    const matchesCategory = selectedCategory === "All" || prompt.category === selectedCategory;

    return matchesSearch && matchesCategory;
  });

  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleLike = async (e: React.MouseEvent, prompt: Prompt) => {
    e.stopPropagation();

    if (likedPrompts.has(prompt.id)) {
      return; // Already liked
    }

    // Optimistic update
    setPrompts(prompts.map(p =>
      p.id === prompt.id ? { ...p, likes: p.likes + 1 } : p
    ));
    if (selectedPrompt?.id === prompt.id) {
      setSelectedPrompt({ ...selectedPrompt, likes: selectedPrompt.likes + 1 });
    }

    // Update local storage
    const newLikedPrompts = new Set(likedPrompts);
    newLikedPrompts.add(prompt.id);
    setLikedPrompts(newLikedPrompts);
    localStorage.setItem('likedPrompts', JSON.stringify(Array.from(newLikedPrompts)));

    // Call Supabase RPC
    if (isSupabaseConfigured()) {
      const { error } = await supabase.rpc('increment_likes', { p_id: prompt.id });
      if (error) {
        console.error('Error incrementing likes:', error);
        // Revert optimistic update on error
        setPrompts(prompts.map(p =>
          p.id === prompt.id ? { ...p, likes: p.likes - 1 } : p
        ));
         if (selectedPrompt?.id === prompt.id) {
            setSelectedPrompt({ ...selectedPrompt, likes: selectedPrompt.likes - 1 });
        }
        newLikedPrompts.delete(prompt.id);
        setLikedPrompts(newLikedPrompts);
        localStorage.setItem('likedPrompts', JSON.stringify(Array.from(newLikedPrompts)));
      }
    }
  };

  const schemaData = {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    "name": "Prompt Notebook",
    "applicationCategory": "Productivity",
    "description": "A curated collection of high-quality AI prompts for coding, writing, art, and more.",
    "offers": {
      "@type": "Offer",
      "price": "0"
    }
  };

  return (
    <div className="min-h-screen bg-base-200 font-sans">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(schemaData) }}
      />
      {/* Navbar */}
      <nav className="sticky top-0 z-50 border-b border-base-content/10 bg-base-100/80 backdrop-blur-md">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-primary rounded-lg">
              <Sparkles className="w-5 h-5 text-primary-content" />
            </div>
            <span className="text-xl font-bold text-base-content">
              PromptNote
            </span>
          </div>
          <div className="flex items-center gap-4">
            {/* Theme Switcher */}
            <div className="dropdown dropdown-end">
              <div tabIndex={0} role="button" className="btn btn-ghost btn-sm btn-circle">
                {theme === 'light' && <Sun className="w-5 h-5" />}
                {theme === 'dark' && <Moon className="w-5 h-5" />}
                {theme === 'system' && <Monitor className="w-5 h-5" />}
              </div>
              <ul tabIndex={0} className="dropdown-content menu bg-base-100 rounded-box z-[1] w-52 p-2 shadow-lg border border-base-content/10">
                <li>
                  <button onClick={() => setTheme('light')} className={theme === 'light' ? 'active' : ''}>
                    <Sun className="w-4 h-4" />
                    Light
                  </button>
                </li>
                <li>
                  <button onClick={() => setTheme('dark')} className={theme === 'dark' ? 'active' : ''}>
                    <Moon className="w-4 h-4" />
                    Dark
                  </button>
                </li>
                <li>
                  <button onClick={() => setTheme('system')} className={theme === 'system' ? 'active' : ''}>
                    <Monitor className="w-4 h-4" />
                    System
                  </button>
                </li>
              </ul>
            </div>
            {user && (
              <Link to="/admin" className="btn btn-ghost btn-sm">
                Admin
              </Link>
            )}
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <div className="hero bg-base-200 py-20">
        <div className="hero-content text-center">
          <div className="max-w-2xl">
            <h1 className="text-5xl font-bold mb-6">
              Discover the Perfect <span className="text-primary">AI Prompt</span>
            </h1>
            <p className="py-6 text-xl text-base-content/70">
              A community-driven library of high-quality prompts for ChatGPT, Midjourney, Claude, and more.
            </p>

            {/* Search Bar */}
            <label className="input w-full shadow-xl">
              <svg className="h-[1em] opacity-50" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
                <g
                  strokeLinejoin="round"
                  strokeLinecap="round"
                  strokeWidth="2.5"
                  fill="none"
                  stroke="currentColor"
                >
                  <circle cx="11" cy="11" r="8"></circle>
                  <path d="m21 21-4.3-4.3"></path>
                </g>
              </svg>
              <input type="search" required placeholder="Search" onChange={(e) => setSearchQuery(e.target.value)} />
            </label>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-12">
        {/* Categories */}
        <div className="flex flex-wrap items-center justify-center gap-2 mb-12">
          {CATEGORIES.map((category) => {
            const Icon = getCategoryIcon(category);
            const isActive = selectedCategory === category;
            return (
              <button
                key={category}
                onClick={() => setSelectedCategory(category)}
                className={cn(
                  "btn btn-sm rounded-full",
                  isActive ? "btn-primary" : "btn-outline border-base-content/20 text-base-content/60 hover:text-base-content"
                )}
              >
                {Icon && <Icon className="w-4 h-4" />}
                {category}
              </button>
            );
          })}
        </div>

        {/* Grid */}
        {loading ? (
          <div className="text-center py-20">
            <span className="loading loading-spinner loading-lg text-primary"></span>
          </div>
        ) : error ? (
          <div className="text-center py-20">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-error/10 mb-4">
              <X className="w-8 h-8 text-error" />
            </div>
            <h3 className="text-xl font-semibold text-base-content mb-2">{error}</h3>
            <p className="text-base-content/60">Please try again later.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredPrompts.map((prompt) => (
              <div
                key={prompt.id}
                onClick={() => setSelectedPrompt(prompt)}
                className="card bg-base-200/50 hover:bg-base-200 border border-base-content/10 hover:border-primary/50 transition-all duration-300 hover:shadow-xl cursor-pointer group"
              >
                <div className="card-body p-6">
                  <div className="flex items-start justify-between mb-4">
                    <div className="badge badge-primary badge-outline gap-2 p-3">
                      {(() => {
                        const Icon = getCategoryIcon(prompt.category);
                        return <Icon className="w-3 h-3" />;
                      })()}
                      {prompt.category}
                    </div>
                    <button
                      onClick={(e) => handleLike(e, prompt)}
                      className={cn(
                        "flex items-center gap-1 text-xs transition-colors hover:scale-110 active:scale-95",
                         likedPrompts.has(prompt.id) ? "text-error" : "text-base-content/60 hover:text-error"
                      )}
                    >
                      <Heart className={cn("w-3 h-3", likedPrompts.has(prompt.id) && "fill-current")} />
                      {prompt.likes}
                    </button>
                  </div>

                  <h3 className="card-title text-base-content mb-2 group-hover:text-primary transition-colors">
                    {prompt.title}
                  </h3>
                  <p className="text-base-content/70 text-sm mb-6 line-clamp-2 flex-grow">
                    {prompt.description}
                  </p>

                  {/* Code/Prompt Preview */}
                  <div className="mockup-code bg-base-300 text-base-content text-xs mb-4 before:hidden">
                    <div className="px-4 py-2">
                      <div className="absolute top-2 right-2">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleCopy(prompt.content, prompt.id);
                          }}
                          className="btn btn-square btn-xs btn-ghost"
                          title="Copy prompt"
                        >
                          {copiedId === prompt.id ? (
                            <Check className="w-4 h-4 text-success" />
                          ) : (
                            <Copy className="w-4 h-4" />
                          )}
                        </button>
                      </div>
                    </div>
                    <pre className="px-4 line-clamp-3 opacity-80">
                      <code>{prompt.content}</code>
                    </pre>
                  </div>

                  <div className="card-actions justify-between items-center mt-auto pt-4 border-t border-base-content/10">
                    <div className="flex flex-wrap gap-2">
                      {prompt.tags.slice(0, 2).map(tag => (
                        <span key={tag} className="badge badge-ghost badge-sm">#{tag}</span>
                      ))}
                    </div>
                    <div className="text-xs text-base-content/60">
                      by <span className="text-base-content font-medium">{prompt.author}</span>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {
          !error && filteredPrompts.length === 0 && (
            <div className="text-center py-20">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-base-300 mb-4">
                <Search className="w-8 h-8 text-base-content/50" />
              </div>
              <h3 className="text-xl font-semibold text-base-content mb-2">No prompts found</h3>
              <p className="text-base-content/60">Try adjusting your search or category filter.</p>
            </div>
          )
        }
      </main>

      {/* Modal */}
      {selectedPrompt && (
        <dialog className="modal modal-open">
          <div className="modal-box w-11/12 max-w-3xl bg-base-100 border border-base-content/10">
            <form method="dialog">
              <button
                onClick={() => setSelectedPrompt(null)}
                className="btn btn-sm btn-circle btn-ghost absolute right-2 top-2"
              >
                <X className="w-5 h-5" />
              </button>
            </form>

            <div className="flex items-center gap-3 mb-6">
              <div className="badge badge-primary badge-outline gap-2 p-3">
                {(() => {
                  const Icon = getCategoryIcon(selectedPrompt.category);
                  return <Icon className="w-4 h-4" />;
                })()}
                {selectedPrompt.category}
              </div>
              <button
                onClick={(e) => handleLike(e, selectedPrompt)}
                className={cn(
                  "flex items-center gap-1 text-sm transition-colors hover:scale-110 active:scale-95",
                  likedPrompts.has(selectedPrompt.id) ? "text-error" : "text-base-content/60 hover:text-error"
                )}
              >
                <Heart className={cn("w-4 h-4", likedPrompts.has(selectedPrompt.id) && "fill-current")} />
                {selectedPrompt.likes}
              </button>
            </div>

            <h3 className="font-bold text-3xl mb-4">{selectedPrompt.title}</h3>
            <p className="py-4 text-lg text-base-content/80">{selectedPrompt.description}</p>

            <div className="mockup-code bg-base-300 text-base-content text-sm mb-8 before:hidden relative">
              <div className="absolute top-2 right-2 z-10">
                <button
                  onClick={() => handleCopy(selectedPrompt.content, selectedPrompt.id)}
                  className="btn btn-sm btn-ghost gap-2"
                >
                  {copiedId === selectedPrompt.id ? (
                    <>
                      <Check className="w-4 h-4 text-success" />
                      <span className="text-success">Copied</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-4 h-4" />
                      <span>Copy</span>
                    </>
                  )}
                </button>
              </div>
              <pre className="px-6 py-4 whitespace-pre-wrap">
                <code>{selectedPrompt.content}</code>
              </pre>
            </div>

            <div className="modal-action justify-between items-center border-t border-base-content/10 pt-6">
              <div className="flex flex-wrap gap-2">
                {selectedPrompt.tags.map(tag => (
                  <span key={tag} className="badge badge-outline">
                    #{tag}
                  </span>
                ))}
              </div>
              <div className="text-sm text-base-content/60">
                Created by <span className="text-base-content font-medium">{selectedPrompt.author}</span>
              </div>
            </div>
          </div>
          <form method="dialog" className="modal-backdrop">
            <button onClick={() => setSelectedPrompt(null)}>close</button>
          </form>
        </dialog>
      )}
    </div>
  );
}

function getCategoryIcon(category: string) {
  switch (category) {
    case 'Coding': return Code;
    case 'Writing': return PenTool;
    case 'Art': return Palette;
    case 'Productivity': return Briefcase;
    case 'Other': return MoreHorizontal;
    default: return Filter;
  }
}
