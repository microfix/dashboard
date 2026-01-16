import React, { useState } from 'react';
import './App.css';
import { useLinks } from './hooks/useLinks';
import type { LinkItem } from './hooks/useLinks';

function App() {
  const { links, addLink, deleteLink, updateLink } = useLinks();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingLink, setEditingLink] = useState<LinkItem | null>(null);
  const [filter, setFilter] = useState('All');
  const [setupStatus, setSetupStatus] = useState<{ type: 'success' | 'error' | 'loading' | null, message: string }>({ type: null, message: '' });

  const handleSetupDb = async () => {
    setSetupStatus({ type: 'loading', message: 'Opsætter database...' });
    try {
      const response = await fetch('/api/setup-db', {
        method: 'POST',
      });

      const contentType = response.headers.get("content-type");
      if (contentType && contentType.indexOf("application/json") !== -1) {
        const data = await response.json();
        if (data.success) {
          setSetupStatus({ type: 'success', message: 'Databasen er klar!' });
        } else {
          setSetupStatus({ type: 'error', message: 'Fejl: ' + data.message });
        }
      } else {
        // Handle non-JSON response (e.g. 502 Bad Gateway HTML)
        const text = await response.text();
        console.error('Non-JSON response from server:', text);
        setSetupStatus({ type: 'error', message: `Server fejl (${response.status}). Se konsol.` });
      }
    } catch (err) {
      console.error('Setup DB Error:', err);
      setSetupStatus({ type: 'error', message: 'Kunne ikke forbinde til serveren.' });
    }
    setTimeout(() => setSetupStatus({ type: null, message: '' }), 5000);
  };


  // Extraction of unique tags
  const allTags = ['All', ...Array.from(new Set(links.flatMap(link => link.tags)))];

  const filteredLinks = filter === 'All'
    ? links
    : links.filter(link => link.tags.includes(filter));

  const handleOpenAddModal = () => {
    setEditingLink(null);
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (link: LinkItem) => {
    setEditingLink(link);
    setIsModalOpen(true);
  };

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const tagsString = formData.get('tags') as string;

    const linkData = {
      title: formData.get('title') as string,
      url: formData.get('url') as string,
      description: formData.get('description') as string,
      imageUrl: formData.get('imageUrl') as string || `https://images.unsplash.com/photo-1614850523296-d8c1af93d400?w=800&auto=format&fit=crop&q=60`,
      tags: tagsString.split(',').map(tag => tag.trim()).filter(tag => tag !== ''),
    };

    if (editingLink) {
      updateLink(editingLink.id, linkData);
    } else {
      addLink(linkData);
    }

    setIsModalOpen(false);
    setEditingLink(null);
  };

  return (
    <div className="app-wrapper">
      <header className="header container">
        <h1 className="title-large">MY APPS<br />COLLECTION</h1>
        <p className="subtitle">
          En kurateret samling af mine eksperimentelle webprojekter.
          Informationen gemmes lokalt i din browser.
        </p>
        <div style={{
          position: 'absolute',
          top: '2rem',
          right: '2rem',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'flex-end',
          gap: '1rem',
          zIndex: 100
        }}>
          <button
            className="setup-db-btn"
            onClick={handleSetupDb}
            disabled={setupStatus.type === 'loading'}
            style={{
              background: 'var(--accent-green)',
              color: 'white',
              border: 'none',
              padding: '0.8rem 1.5rem',
              fontSize: '0.8rem',
              fontWeight: 'bold',
              cursor: 'pointer',
              borderRadius: '4px',
              transition: 'all 0.2s ease',
              boxShadow: '0 4px 15px rgba(0,0,0,0.5)'
            }}
          >
            {setupStatus.type === 'loading' ? 'OPSÆTTER...' : 'SETUP DATABASE'}
          </button>
          {setupStatus.message && (
            <div style={{
              padding: '0.5rem 1rem',
              borderRadius: '4px',
              fontSize: '0.8rem',
              background: setupStatus.type === 'success' ? '#4b5320' : setupStatus.type === 'error' ? '#8b0000' : 'rgba(255,255,255,0.1)',
              color: 'white',
              animation: 'fadeIn 0.3s ease',
              maxWidth: '300px',
              textAlign: 'right'
            }}>
              {setupStatus.message}
            </div>
          )}
        </div>
      </header>

      <section className="controls container">
        <div className="filter-bar">
          {allTags.map(tag => (
            <button
              key={tag}
              className={`filter-tag ${filter === tag ? 'active' : ''}`}
              onClick={() => setFilter(tag)}
            >
              {tag}
            </button>
          ))}
        </div>
        <button className="add-button" onClick={handleOpenAddModal}>
          + NEW PROJECT
        </button>
      </section>

      <main className="dashboard-grid container">
        {filteredLinks.length > 0 ? (
          filteredLinks.map((link) => (
            <div key={link.id} className="card-item" onClick={() => window.open(link.url, '_blank')}>
              <img src={link.imageUrl} alt={link.title} className="card-image" />
              <div className="card-tags">
                {link.tags.map(tag => <span key={tag} className="tag">{tag}</span>)}
              </div>
              <div className="card-overlay">
                <h2 className="card-title">{link.title}</h2>
                <p className="card-description">{link.description}</p>
              </div>
              <div style={{ position: 'absolute', top: '1rem', right: '1rem', display: 'flex', gap: '0.5rem', zIndex: 10 }}>
                <button
                  className="edit-btn"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleOpenEditModal(link);
                  }}
                  style={{
                    background: 'rgba(75, 83, 32, 0.8)',
                    color: 'white',
                    borderRadius: '50%',
                    width: '32px',
                    height: '32px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '0.8rem'
                  }}
                >
                  ✎
                </button>
                <button
                  className="delete-btn"
                  onClick={(e) => {
                    e.stopPropagation();
                    if (confirm('Er du sikker på, at du vil slette dette link?')) deleteLink(link.id);
                  }}
                  style={{
                    background: 'rgba(255, 255, 255, 0.2)',
                    color: 'white',
                    borderRadius: '50%',
                    width: '32px',
                    height: '32px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '0.8rem'
                  }}
                >
                  ✕
                </button>
              </div>
            </div>
          ))
        ) : (
          <div style={{ gridColumn: '1 / -1', textAlign: 'center', padding: '4rem', color: 'var(--text-secondary)' }}>
            Ingen projekter fundet. Klik på "+ NEW PROJECT" for at komme i gang.
          </div>
        )}
      </main>

      {isModalOpen && (
        <div className="modal-backdrop" onClick={() => setIsModalOpen(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h2 style={{ marginBottom: '2rem', fontSize: '2rem' }}>{editingLink ? 'REDIGER PROJEKT' : 'TILFØJ NYT PROJEKT'}</h2>
            <form onSubmit={handleSubmit}>
              <div className="form-group">
                <label>Projekt Titel</label>
                <input name="title" required defaultValue={editingLink?.title} placeholder="f.eks. Mit Awesome Projekt" />
              </div>
              <div className="form-group">
                <label>URL (app.domain.dk/xx)</label>
                <input name="url" type="url" required defaultValue={editingLink?.url} placeholder="https://" />
              </div>
              <div className="form-group">
                <label>Beskrivelse</label>
                <textarea name="description" rows={3} defaultValue={editingLink?.description} placeholder="Hvad gør denne app?" />
              </div>
              <div className="form-group">
                <label>Billede URL (Valgfri)</label>
                <input name="imageUrl" defaultValue={editingLink?.imageUrl} placeholder="https://images.unsplash.com/..." />
              </div>
              <div className="form-group">
                <label>Tags (kommasepareret)</label>
                <input name="tags" defaultValue={editingLink?.tags.join(', ')} placeholder="React, Utility, Spil" />
              </div>
              <div className="form-actions">
                <button type="button" className="btn-cancel" onClick={() => setIsModalOpen(false)}>ANNULLER</button>
                <button type="submit" className="btn-submit">GEM PROJEKT</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
