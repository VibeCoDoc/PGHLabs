import React from 'react';
import { ClipboardList } from 'lucide-react';

const ManiTab: React.FC = () => {
  return (
    <div id="second-tool" className="tool-content active">
      <div className="input-section">
        <div id="title-logo-wrapper">
          <ClipboardList className="w-10 h-10 mr-3 text-[#334155]" />
          <h2>Soon...</h2>
        </div>
      </div>
    </div>
  );
};

export default ManiTab;
