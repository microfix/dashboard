import { useState, useEffect } from 'react';

export interface LinkItem {
    id: string;
    title: string;
    url: string;
    description: string;
    imageUrl: string;
    tags: string[];
    createdAt: number;
}

export const useLinks = () => {
    const [links, setLinks] = useState<LinkItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // Fetch links from the API
    const fetchLinks = async () => {
        try {
            setLoading(true);
            const response = await fetch('/api/links');
            if (response.ok) {
                const data = await response.json();
                setLinks(data);
            } else {
                console.error('Failed to fetch links');
                // Optional: Fallback to empty or keep loading false
            }
        } catch (err) {
            console.error('Error fetching links:', err);
            setError('Could not load links');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchLinks();
    }, []);

    const addLink = async (link: Omit<LinkItem, 'id' | 'createdAt'>) => {
        const linkData = { ...link, createdAt: Date.now() };
        try {
            const response = await fetch('/api/links', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(linkData)
            });
            if (response.ok) {
                const newLink = await response.json();
                setLinks(prev => [newLink, ...prev]);
            }
        } catch (err) {
            console.error('Error adding link:', err);
        }
    };

    const deleteLink = async (id: string) => {
        try {
            const response = await fetch(`/api/links/${id}`, { method: 'DELETE' });
            if (response.ok) {
                setLinks(prev => prev.filter(link => link.id !== id));
            }
        } catch (err) {
            console.error('Error deleting link:', err);
        }
    };

    const updateLink = async (id: string, updatedLink: Partial<Omit<LinkItem, 'id' | 'createdAt'>>) => {
        try {
            const response = await fetch(`/api/links/${id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(updatedLink)
            });
            if (response.ok) {
                const savedLink = await response.json();
                setLinks(prev => prev.map(link => link.id === id ? savedLink : link));
            }
        } catch (err) {
            console.error('Error updating link:', err);
        }
    };

    return { links, loading, error, addLink, deleteLink, updateLink };
};
