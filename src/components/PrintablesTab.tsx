import React, { useState } from 'react';
import { ClipboardList } from 'lucide-react';

const PrintablesTab: React.FC = () => {
  const [selectedFile, setSelectedFile] = useState<string | null>(null);

  const forms = [
    { id: 'lrf', label: 'Laboratory Request Form (4s for A4)', file: '/lrf.pdf' },
    { id: 'slrf', label: 'Laboratory Request Form (1s for A6)', file: '/slrf.pdf' },
    { id: 'ef', label: 'Equilife Form', file: '/ef.pdf' },
    { id: 'rivf', label: 'RIV Form', file: '/rivf.pdf' },
  ];

  return (
    <div id="third-tool" className="tool-content active">
      <div className="input-section">
        <div id="title-logo-wrapper">
          <ClipboardList className="w-10 h-10 mr-3 text-[#334155]" />
          <h2>Printables Repository</h2>
        </div>

        <div className="mt-2 p-3 bg-amber-50 border border-amber-200 rounded-lg text-amber-800 text-sm">
          <strong>Note:</strong> Please ensure the PDF files (e.g., <code>lrf.pdf</code>, <code>charge_slip.pdf</code>) are uploaded to the <code>public/</code> folder to enable previews and downloads.
        </div>

        <div className="input-column">
          <div className="bg-white border border-[#ced4da] p-[15px] rounded-lg my-5 shadow-[0_6px_15px_rgba(0,0,0,0.05)]">
            <p className="text-base mt-1.25 text-[#374151]">
              <strong>• Use only for emergency:</strong> Procure forms from nurse stations as much as possible.
            </p>
            <p className="text-base mt-1.25 text-[#374151]">
              <strong>• Select a form below to view a printable PDF preview. Press printer button to print.</strong>
            </p>
          </div>

          <div className="flex gap-[15px] flex-wrap mb-[30px]">
            {forms.map(form => (
              <button key={form.id} onClick={() => setSelectedFile(form.file)}>
                {form.label}
              </button>
            ))}
          </div>
        </div>

        {selectedFile && (
          <div className="w-full mt-5">
            <button 
              className="fixed right-[3vw] bg-[#334155] mt-[50px] pt-1.5 text-[10pt] h-[30px] w-[300px]"
              onClick={() => window.print()}
            >
              Use browser print dialog (Ctrl+P/Share-&gt;Print) to print
            </button>
            <iframe 
              src={selectedFile} 
              className="w-full h-[50vh] border-none"
              title="Printable Preview"
            />
          </div>
        )}
      </div>
    </div>
  );
};

export default PrintablesTab;
