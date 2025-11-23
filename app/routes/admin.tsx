import { useState, useEffect } from "react";
import type { Route } from "./+types/admin";
import { supabase, type Prompt, isUserAdmin } from "../lib/supabase";
import { useNavigate } from "react-router";
import { Plus, Edit, Trash2, X, LogOut, Search, Code, PenTool, Palette, Briefcase, MoreHorizontal } from "lucide-react";


export function meta({ }: Route.MetaArgs) {
    return [
        { title: "Admin | Prompt Notebook" },
        { name: "description", content: "Manage your AI prompts" },
    ];
}

export default function Admin() {
    const navigate = useNavigate();
    const [user, setUser] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [prompts, setPrompts] = useState<Prompt[]>([]);
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [showModal, setShowModal] = useState(false);
    const [editingPrompt, setEditingPrompt] = useState<Prompt | null>(null);
    const [searchTerm, setSearchTerm] = useState("");
    const [formData, setFormData] = useState({
        title: "",
        description: "",
        content: "",
        tags: "",
        author: "",
        category: "Coding" as Prompt["category"],
    });

    useEffect(() => {
        checkUser();
    }, []);

    useEffect(() => {
        if (user) {
            fetchPrompts();
        }
    }, [user]);

    async function checkUser() {
        const { data: { session } } = await supabase.auth.getSession();
        const currentUser = session?.user ?? null;

        if (currentUser) {
            // Check if user has admin role
            const hasAdminAccess = await isUserAdmin(currentUser.id);
            if (!hasAdminAccess) {
                // User is logged in but not an admin, redirect to home
                alert('Access denied. Admin privileges required.');
                navigate('/');
                return;
            }
        }

        setUser(currentUser);
        setLoading(false);
    }

    async function fetchPrompts() {
        const { data, error } = await supabase
            .from('prompts')
            .select('*')
            .eq('user_id', user.id)
            .order('created_at', { ascending: false });

        if (error) {
            console.error('Error fetching prompts:', error);
        } else {
            setPrompts(data || []);
        }
    }

    async function handleLogin(e: React.FormEvent) {
        e.preventDefault();
        const { error } = await supabase.auth.signInWithPassword({
            email,
            password,
        });

        if (error) {
            alert(error.message);
        } else {
            checkUser();
        }
    }

    async function handleLogout() {
        await supabase.auth.signOut();
        navigate('/');
    }

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault();

        const promptData = {
            ...formData,
            tags: formData.tags.split(',').map(t => t.trim()).filter(t => t),
            user_id: user.id,
            likes: editingPrompt?.likes || 0,
        };

        if (editingPrompt) {
            const { error } = await supabase
                .from('prompts')
                .update(promptData)
                .eq('id', editingPrompt.id);

            if (error) {
                alert(error.message);
            } else {
                setShowModal(false);
                resetForm();
                fetchPrompts();
            }
        } else {
            const { error } = await supabase
                .from('prompts')
                .insert([promptData]);

            if (error) {
                alert(error.message);
            } else {
                setShowModal(false);
                resetForm();
                fetchPrompts();
            }
        }
    }

    async function handleDelete(id: string) {
        if (!confirm('Are you sure you want to delete this prompt?')) return;

        const { error } = await supabase
            .from('prompts')
            .delete()
            .eq('id', id);

        if (error) {
            alert(error.message);
        } else {
            fetchPrompts();
        }
    }

    function openEditModal(prompt: Prompt) {
        setEditingPrompt(prompt);
        setFormData({
            title: prompt.title,
            description: prompt.description,
            content: prompt.content,
            tags: prompt.tags.join(', '),
            author: prompt.author,
            category: prompt.category,
        });
        setShowModal(true);
    }

    function resetForm() {
        setEditingPrompt(null);
        setFormData({
            title: "",
            description: "",
            content: "",
            tags: "",
            author: "",
            category: "Coding",
        });
    }

    const getCategoryIcon = (category: string) => {
        switch (category) {
            case "Coding": return <Code className="w-4 h-4" />;
            case "Writing": return <PenTool className="w-4 h-4" />;
            case "Art": return <Palette className="w-4 h-4" />;
            case "Productivity": return <Briefcase className="w-4 h-4" />;
            default: return <MoreHorizontal className="w-4 h-4" />;
        }
    };

    const filteredPrompts = prompts.filter(p =>
        p.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        p.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
        p.tags.some(t => t.toLowerCase().includes(searchTerm.toLowerCase()))
    );

    if (loading) {
        return (
            <div className="min-h-screen bg-base-200 flex items-center justify-center">
                <div className="flex flex-col gap-4 w-52">
                    <div className="skeleton h-32 w-full"></div>
                    <div className="skeleton h-4 w-28"></div>
                    <div className="skeleton h-4 w-full"></div>
                    <div className="skeleton h-4 w-full"></div>
                </div>
            </div>
        );
    }

    if (!user) {
        return (
            <div className="min-h-screen bg-base-200 flex items-center justify-center p-4">
                <div className="card bg-base-100 w-full max-w-md shadow-2xl hover:shadow-3xl transition-shadow duration-300">
                    <div className="card-body">
                        <h2 className="card-title text-2xl font-bold text-center mb-6 justify-center">Admin Access</h2>
                        <form onSubmit={handleLogin} className="space-y-6">
                            <label className="floating-label w-full">
                                <span>Email</span>
                                <input
                                    type="email"
                                    placeholder="email@example.com"
                                    className="input input-lg w-full"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    required
                                />
                            </label>
                            <label className="floating-label w-full">
                                <span>Password</span>
                                <input
                                    type="password"
                                    placeholder="••••••••"
                                    className="input input-lg w-full"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    required
                                />
                            </label>
                            <div className="card-actions justify-end mt-4">
                                <button type="submit" className="btn btn-primary btn-block btn-lg">Login</button>
                            </div>
                        </form>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-base-200/50">
            {/* Navbar */}
            <div className="navbar bg-base-100/80 backdrop-blur-md sticky top-0 z-50 border-b border-base-300">
                <div className="flex-1">
                    <a href="/" className="btn btn-ghost text-xl font-bold bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">
                        Prompt Notebook
                    </a>
                </div>
                <div className="flex-none gap-4">
                    <div className="hidden md:flex items-center gap-2 text-sm text-base-content/70 bg-base-200 px-3 py-1 rounded-full">
                        <div className="avatar placeholder">
                            <div className="bg-neutral text-neutral-content rounded-full w-6">
                                <span className="text-xs">{user.email[0].toUpperCase()}</span>
                            </div>
                        </div>
                        {user.email}
                    </div>
                    <button onClick={handleLogout} className="btn btn-ghost btn-sm text-error">
                        <LogOut className="w-4 h-4" />
                        <span className="hidden sm:inline">Logout</span>
                    </button>
                </div>
            </div>

            <div className="container mx-auto px-4 py-8 max-w-7xl">
                {/* Header Section */}
                <div className="flex flex-col md:flex-row justify-between items-center mb-10 gap-4">
                    <div>
                        <h1 className="text-4xl font-black tracking-tight mb-2">Dashboard</h1>
                        <p className="text-base-content/60">Manage and organize your prompt collection</p>
                    </div>
                    <div className="flex gap-3 w-full md:w-auto">
                        <label className="input input-bordered flex items-center gap-2 w-full md:w-64">
                            <Search className="w-4 h-4 opacity-70" />
                            <input
                                type="text"
                                className="grow"
                                placeholder="Search prompts..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                            />
                        </label>
                        <button
                            onClick={() => {
                                resetForm();
                                setShowModal(true);
                            }}
                            className="btn btn-primary shadow-lg hover:shadow-primary/30 transition-all"
                        >
                            <Plus className="w-5 h-5" />
                            New Prompt
                        </button>
                    </div>
                </div>

                {/* Prompts Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {filteredPrompts.map((prompt) => (
                        <div
                            key={prompt.id}
                            className="card bg-base-100 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-300 border border-base-200 group"
                        >
                            <div className="card-body">
                                <div className="flex justify-between items-start mb-2">
                                    <div className={`badge badge-soft gap-1 ${prompt.category === 'Coding' ? 'badge-primary' :
                                        prompt.category === 'Writing' ? 'badge-secondary' :
                                            prompt.category === 'Art' ? 'badge-accent' :
                                                'badge-neutral'
                                        }`}>
                                        {getCategoryIcon(prompt.category)}
                                        {prompt.category}
                                    </div>
                                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                        <button onClick={() => openEditModal(prompt)} className="btn btn-ghost btn-xs btn-square">
                                            <Edit className="w-3 h-3" />
                                        </button>
                                        <button onClick={() => handleDelete(prompt.id)} className="btn btn-ghost btn-xs btn-square text-error">
                                            <Trash2 className="w-3 h-3" />
                                        </button>
                                    </div>
                                </div>
                                <h2 className="card-title text-lg font-bold mb-1">{prompt.title}</h2>
                                <p className="text-base-content/70 text-sm line-clamp-3 mb-4">{prompt.description}</p>

                                <div className="flex flex-wrap gap-1 mt-auto">
                                    {prompt.tags.map((tag, i) => (
                                        <span key={i} className="badge badge-xs badge-outline opacity-70">#{tag}</span>
                                    ))}
                                </div>
                            </div>
                        </div>
                    ))}
                </div>

                {filteredPrompts.length === 0 && (
                    <div className="text-center py-20 bg-base-100 rounded-box border border-dashed border-base-300">
                        <div className="max-w-md mx-auto">
                            <h3 className="text-lg font-bold opacity-50">No prompts found</h3>
                            <p className="text-base-content/40">Get started by creating your first prompt!</p>
                        </div>
                    </div>
                )}
            </div>

            {/* Modal */}
            {showModal && (
                <dialog className="modal modal-open modal-bottom sm:modal-middle backdrop-blur-sm">
                    <div className="modal-box w-11/12 max-w-3xl p-0 overflow-hidden">
                        <div className="bg-base-200 px-6 py-4 flex justify-between items-center border-b border-base-300">
                            <h3 className="font-bold text-lg">{editingPrompt ? 'Edit Prompt' : 'Create New Prompt'}</h3>
                            <button onClick={() => setShowModal(false)} className="btn btn-sm btn-circle btn-ghost">
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        <form onSubmit={handleSubmit} className="p-6 space-y-4">
                            <fieldset className="fieldset w-full bg-base-100 border border-base-300 p-4 rounded-box">
                                <legend className="fieldset-legend">Basic Info</legend>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <label className="floating-label">
                                        <span>Title</span>
                                        <input
                                            type="text"
                                            placeholder="Prompt Title"
                                            className="input w-full"
                                            value={formData.title}
                                            onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                                            required
                                        />
                                    </label>

                                    <label className="floating-label">
                                        <span>Author</span>
                                        <input
                                            type="text"
                                            placeholder="Your Name"
                                            className="input w-full"
                                            value={formData.author}
                                            onChange={(e) => setFormData({ ...formData, author: e.target.value })}
                                            required
                                        />
                                    </label>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                                    <label className="floating-label">
                                        <span>Category</span>
                                        <select
                                            className="select w-full"
                                            value={formData.category}
                                            onChange={(e) => setFormData({ ...formData, category: e.target.value as Prompt["category"] })}
                                        >
                                            <option value="Coding">Coding</option>
                                            <option value="Writing">Writing</option>
                                            <option value="Art">Art</option>
                                            <option value="Productivity">Productivity</option>
                                            <option value="Other">Other</option>
                                        </select>
                                    </label>

                                    <label className="floating-label">
                                        <span>Tags</span>
                                        <input
                                            type="text"
                                            placeholder="react, typescript, tailwind"
                                            className="input w-full"
                                            value={formData.tags}
                                            onChange={(e) => setFormData({ ...formData, tags: e.target.value })}
                                        />
                                    </label>
                                </div>
                            </fieldset>

                            <fieldset className="fieldset w-full bg-base-100 border border-base-300 p-4 rounded-box">
                                <legend className="fieldset-legend">Content</legend>

                                <label className="floating-label mb-4">
                                    <span>Description</span>
                                    <textarea
                                        className="textarea w-full h-20"
                                        placeholder="Brief description of what this prompt does..."
                                        value={formData.description}
                                        onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                                        required
                                    />
                                </label>

                                <label className="floating-label">
                                    <span>Prompt Content</span>
                                    <textarea
                                        className="textarea w-full h-40 font-mono text-sm"
                                        placeholder="The actual prompt text..."
                                        value={formData.content}
                                        onChange={(e) => setFormData({ ...formData, content: e.target.value })}
                                        required
                                    />
                                </label>
                            </fieldset>

                            <div className="modal-action mt-6">
                                <button type="button" onClick={() => setShowModal(false)} className="btn">Cancel</button>
                                <button type="submit" className="btn btn-primary px-8">Save Prompt</button>
                            </div>
                        </form>
                    </div>
                    <form method="dialog" className="modal-backdrop">
                        <button onClick={() => setShowModal(false)}>close</button>
                    </form>
                </dialog>
            )}
        </div>
    );
}
