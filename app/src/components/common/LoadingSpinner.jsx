import React from 'react';
import './LoadingSpinner.css';

export default function LoadingSpinner({ small }) {
  return (
    <div className={`spinner-container ${small ? 'small' : ''}`}>
      <div className="spinner"></div>
      {!small && <p>Chargement...</p>}
    </div>
  );
}
