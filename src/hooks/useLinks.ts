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

    useEffect(() => {
        const savedLinks = localStorage.getItem('app-dashboard-links');
        if (savedLinks) {
            try {
                setLinks(JSON.parse(savedLinks));
            } catch (e) {
                console.error('Failed to parse links from localStorage', e);
            }
        } else {
            // Seed data
            const initialLinks: LinkItem[] = [
                {
                    id: '1',
                    title: 'NEON RUNNER',
                    url: 'https://example.com/neon',
                    description: 'A high-speed synthwave arcade game built with Three.js.',
                    imageUrl: 'https://images.unsplash.com/photo-1614850523296-d8c1af93d400?w=800&auto=format&fit=crop&q=60',
                    tags: ['Game', '3D'],
                    createdAt: Date.now()
                },
                {
                    id: '2',
                    title: 'VIBE CALENDAR',
                    url: 'https://example.com/calendar',
                    description: 'A minimalist productivity tool focused on mood and focus.',
                    imageUrl: 'https://images.unsplash.com/photo-1506744038136-46273834b3fb?w=800&auto=format&fit=crop&q=60',
                    tags: ['Utility', 'Minimalist'],
                    createdAt: Date.now() - 1000
                },
                {
                    id: '3',
                    title: 'AUDIO VISUALIZER',
                    url: 'https://example.com/audio',
                    description: 'Real-time frequency analysis with dynamic particle systems.',
                    imageUrl: 'https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=800&auto=format&fit=crop&q=60',
                    tags: ['Audio', 'Creative'],
                    createdAt: Date.now() - 2000
                }
            ];
            setLinks(initialLinks);
            localStorage.setItem('app-dashboard-links', JSON.stringify(initialLinks));
        }
    }, []);

    const saveLinks = (newLinks: LinkItem[]) => {
        setLinks(newLinks);
        localStorage.setItem('app-dashboard-links', JSON.stringify(newLinks));
    };

    const addLink = (link: Omit<LinkItem, 'id' | 'createdAt'>) => {
        const newLink: LinkItem = {
            ...link,
            id: crypto.randomUUID(),
            createdAt: Date.now(),
        };
        saveLinks([newLink, ...links]);
    };

    const deleteLink = (id: string) => {
        saveLinks(links.filter((link) => link.id !== id));
    };

    const updateLink = (id: string, updatedLink: Partial<Omit<LinkItem, 'id' | 'createdAt'>>) => {
        saveLinks(links.map((link) => link.id === id ? { ...link, ...updatedLink } : link));
    };

    return { links, addLink, deleteLink, updateLink };
};
