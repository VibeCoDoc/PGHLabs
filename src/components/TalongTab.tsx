import React, { useState, useEffect } from 'react';
import { LabRequest, MaterialDetail, Reminder } from '../types';
import { extractLabData } from '../services/gemini';
import LabForm from './LabForm';
import { CUP_SPECIMENS, NUCMED_SCHEDULE, MRL_TB_TESTS, DAY_ABBREVIATIONS, getParsedLookup, LookupEntry } from '../constants';
import { ClipboardList } from 'lucide-react';

const TalongTab: React.FC = () => {
  const [unstructured, setUnstructured] = useState('');
  const [manualName, setManualName] = useState('');
  const [manualBirthday, setManualBirthday] = useState('');
  const [manualAge, setManualAge] = useState('');
  const [manualSex, setManualSex] = useState('');
  const [manualCN, setManualCN] = useState('');
  const [manualLocation, setManualLocation] = useState('');
  const [manualLabs, setManualLabs] = useState('');
  const [showLookup, setShowLookup] = useState(false);
  const [lookupSearch, setLookupSearch] = useState('');
  const [forms, setForms] = useState<LabRequest[]>([]);
  const [collector, setCollector] = useState(localStorage.getItem('pgh_collector_name') || '');
  const [timeCollected, setTimeCollected] = useState('');
  const [isEr, setIsEr] = useState(localStorage.getItem('pgh_er_override') === 'true');
  const [showFullGenerator, setShowFullGenerator] = useState(false);
  const [loading, setLoading] = useState(false);
  const [materials, setMaterials] = useState<Record<string, MaterialDetail>>({});
  const [expandedMaterials, setExpandedMaterials] = useState<Record<string, boolean>>({});
  const [reminders, setReminders] = useState<Reminder[]>([]);

  useEffect(() => {
    localStorage.setItem('pgh_collector_name', collector);
  }, [collector]);

  useEffect(() => {
    localStorage.setItem('pgh_er_override', String(isEr));
  }, [isEr]);

  const getCurrentDateMMDD = () => {
    const now = new Date();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    return `${month}-${day}`;
  };

  const handleAutoFill = async () => {
    if (!unstructured.trim()) return;
    setLoading(true);
    try {
      const data = await extractLabData(unstructured, collector, getCurrentDateMMDD());
      if (data && data.length > 0) {
        const first = data[0];
        setManualName(first.name || '');
        setManualBirthday(first.birthday || '');
        
        const ageSex = first.age_sex || '';
        const ageMatch = ageSex.match(/(\d+)/);
        const sexMatch = ageSex.match(/(M|F)/i);
        setManualAge(ageMatch ? ageMatch[1] : '');
        setManualSex(sexMatch ? sexMatch[1].toUpperCase() : '');
        
        setManualCN(first.case_number || '');
        setManualLocation(first.ward_location || '');
        setManualLabs(first.requests_list || '');

        const newForms: LabRequest[] = data.map(item => {
          const form: LabRequest = {
            name: item.name || '',
            ward_location: item.ward_location || '',
            age_sex: item.age_sex || '',
            birthday: item.birthday || '',
            case_number: item.case_number || '',
            diagnosis: item.diagnosis || '',
            requested_by: item.requested_by || '',
            date_collected: item.date_collected || '',
            time_collected: item.time_collected || '',
            collected_by: item.collected_by || '',
            specimen_type: item.specimen_type || '',
            site_of_collection: item.site_of_collection || '',
            form_type: item.form_type || '',
            tube_top: item.tube_top || '',
            requests_list: item.requests_list || ''
          };
          if (isEr) form.ward_location = "ER";
          if (timeCollected) form.time_collected = timeCollected;
          if (collector) form.collected_by = collector.toUpperCase();
          return form;
        });
        setForms(newForms);
        calculateMaterialsAndReminders(newForms);
      }
    } catch (error) {
      console.error(error);
      alert("Error extracting data. Check console.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const lookup = getParsedLookup();
    const rawLines = manualLabs.split(/[\n,]/).map(l => l.trim()).filter(l => l !== '');
    const lines: string[] = [];
    
    rawLines.forEach(line => {
      const lower = line.toLowerCase();
      if (lower.includes('lipid panel')) {
        lines.push('Total cholesterol', 'Triglycerides', 'LDL', 'HDL');
      } else if (lower.includes('hepatitis panel')) {
        lines.push('HBsAg', 'Anti-HBs', 'Anti-HBc Total', 'Anti-HCV');
      } else {
        lines.push(line);
      }
    });
    
    if (lines.length === 0 && !manualName && !manualLocation && !manualAge && !manualSex && !manualCN) {
      if (forms.length > 0) {
        setForms([]);
        setMaterials({});
        setReminders([]);
      }
      return;
    }

    const matchedTests: (LookupEntry & { originalInput: string })[] = lines.map(line => {
      const lowerLine = line.toLowerCase();
      const normalizedInput = lowerLine.replace(/[^a-z0-9]/g, '');
      
      // Try exact match first (normalized)
      let match = lookup.find(entry => 
        entry.testName.toLowerCase().replace(/[^a-z0-9]/g, '') === normalizedInput ||
        (entry.testName.toUpperCase() === 'UA' && normalizedInput === 'urinalysis') ||
        (entry.testName.toUpperCase() === 'UA' && normalizedInput === 'ua')
      );

      // Try partial match if no exact match
      if (!match) {
        // Sort lookup by name length descending to match longer specific names first
        const sortedLookup = [...lookup].sort((a, b) => b.testName.length - a.testName.length);
        match = sortedLookup.find(entry => 
          lowerLine.includes(entry.testName.toLowerCase()) ||
          entry.testName.toLowerCase().includes(lowerLine)
        );
      }

      if (match) return { ...match, originalInput: line };

      // Better fallback based on keywords
      let fallbackSpecimen = 'Blood';
      let fallbackTop = 'Unidentified request';
      let fallbackForm = 'Chemistry';

      if (lowerLine.includes('stool') || lowerLine.includes('fecal')) {
        fallbackSpecimen = 'Stool';
        fallbackTop = 'N/A';
        fallbackForm = 'Clinical Microscopy';
      } else if (lowerLine.includes('urine') || lowerLine.includes('ua')) {
        fallbackSpecimen = 'Urine';
        fallbackTop = 'N/A';
        fallbackForm = 'Urinalysis';
      } else if (lowerLine.includes('csf')) {
        fallbackSpecimen = 'CSF';
        fallbackTop = 'N/A';
        fallbackForm = 'Chemistry';
      }

      return { 
        testName: line, 
        specimen: fallbackSpecimen, 
        top: fallbackTop, 
        formType: fallbackForm, 
        originalInput: line 
      };
    });

    // Grouping Logic
    const groupedRequests: LabRequest[] = [];
    const bloodGroups: Record<string, LookupEntry[]> = {};
    const urineChemGroup: LookupEntry[] = [];
    const cultureGroups: Record<string, LookupEntry[]> = {}; // Grouped by specimen (Sputum, ETA, etc)
    const specialTests: LookupEntry[] = []; // Biofire, GeneXpert

    matchedTests.forEach(test => {
      const nameUpper = test.testName.toUpperCase();
      const isSpecial = nameUpper.includes('BIOFIRE') || nameUpper.includes('GENEXPERT') || nameUpper.includes('MTB/RIF');
      const isApas = nameUpper.includes('APAS PANEL');
      
      if (isSpecial) {
        specialTests.push(test);
      } else if (isApas) {
        groupedRequests.push(createFormFromTests([test]));
      } else if (test.specimen === 'Urine' && test.formType === 'Chemistry') {
        urineChemGroup.push(test);
      } else if (['Sputum', 'ETA', 'Pleural Fluid', 'Ascitic Fluid', 'Pericardial Fluid', 'Body Fluid'].includes(test.specimen) && 
                 (nameUpper.includes('GS/CS') || nameUpper.includes('AFB') || nameUpper.includes('C/S'))) {
        if (!cultureGroups[test.specimen]) cultureGroups[test.specimen] = [];
        cultureGroups[test.specimen].push(test);
      } else if (test.specimen === 'Blood') {
        const key = `${test.formType}|${test.top}`;
        if (!bloodGroups[key]) bloodGroups[key] = [];
        bloodGroups[key].push(test);
      } else {
        // Default: separate form
        groupedRequests.push(createFormFromTests([test]));
      }
    });

    // Process Groups
    Object.values(bloodGroups).forEach(group => groupedRequests.push(createFormFromTests(group)));
    if (urineChemGroup.length > 0) groupedRequests.push(createFormFromTests(urineChemGroup));
    Object.values(cultureGroups).forEach(group => groupedRequests.push(createFormFromTests(group)));
    specialTests.forEach(test => groupedRequests.push(createFormFromTests([test], 'Special')));

    function createFormFromTests(tests: LookupEntry[], overrideFormType?: string): LabRequest {
      const first = tests[0];
      const ageSex = `${manualAge}${manualSex}`;
      
      // Handle naming for non-blood
      const requestsList = tests.map(t => {
        if (t.specimen !== 'Blood' && !t.testName.toLowerCase().includes(t.specimen.toLowerCase())) {
          if (t.testName.toUpperCase() === 'UA') return 'Urinalysis';
          if (t.testName.toUpperCase() === 'FECALYSIS') return 'Fecalysis';
          return `${t.specimen} ${t.testName}`;
        }
        return t.testName;
      }).join(', ');

      const form: LabRequest = {
        name: manualName.toUpperCase(),
        ward_location: isEr ? "ER" : manualLocation.toUpperCase(),
        age_sex: ageSex,
        birthday: manualBirthday,
        case_number: manualCN,
        diagnosis: '', 
        requested_by: '',
        date_collected: getCurrentDateMMDD(),
        time_collected: timeCollected,
        collected_by: collector.toUpperCase(),
        specimen_type: first.specimen,
        site_of_collection: '',
        form_type: overrideFormType || first.formType,
        tube_top: first.top,
        requests_list: requestsList
      };
      return form;
    }

    setForms(groupedRequests);
    calculateMaterialsAndReminders(groupedRequests);
  }, [manualName, manualBirthday, manualAge, manualSex, manualCN, manualLocation, manualLabs, isEr, timeCollected, collector]);

  const calculateMaterialsAndReminders = (formList: LabRequest[]) => {
    const matDetails: Record<string, MaterialDetail> = {};
    const rems = new Set<string>();
    const criticalRems: Reminder[] = [];
    let cupCount = 0;
    let bcsCount = 0;
    const iceTests = new Set<string>();
    let isLactate = false;

    const activeForms = formList.filter(f => f.name || f.requests_list);

    activeForms.forEach(form => {
      const tube = form.tube_top.toUpperCase();
      const requests = form.requests_list.toUpperCase();
      const specimen = form.specimen_type.toLowerCase();

      if (requests.includes('APAS PANEL')) {
        // Special case for APAS Panel: 2 Red + 5 Blue (White)
        if (!matDetails['RED']) matDetails['RED'] = { count: 0, tests: [] };
        matDetails['RED'].count += 2;
        matDetails['RED'].tests.push('APAS Panel (2 Red)');

        if (!matDetails['BLUE (WHITE)']) matDetails['BLUE (WHITE)'] = { count: 0, tests: [] };
        matDetails['BLUE (WHITE)'].count += 5;
        matDetails['BLUE (WHITE)'].tests.push('APAS Panel (5 Blue White)');
      } else if (tube !== 'N/A' && tube) {
        if (!matDetails[tube]) matDetails[tube] = { count: 0, tests: [] };
        matDetails[tube].count++;
        matDetails[tube].tests.push(form.requests_list);
      }

      if (CUP_SPECIMENS.includes(specimen)) {
        cupCount++;
        if (!matDetails['SPECIMEN CUP']) matDetails['SPECIMEN CUP'] = { count: 0, tests: [] };
        matDetails['SPECIMEN CUP'].count++;
        matDetails['SPECIMEN CUP'].tests.push(form.requests_list);
      }

      if (requests.includes('BLOOD CS') || requests.includes('BLOOD C/S')) {
        bcsCount++;
      }

      // Reminders
      if (tube === 'BLUE') rems.add("BLUE TOP: Fill to the indicator line.");
      if (requests.includes('VANCO TROUGH')) rems.add("For Vanco Trough, Cover red top with carbon paper prior to extraction.");
      
      ['ICA', 'NH3', 'LACTATE'].forEach(test => {
        if (requests.includes(test) || (test === 'ICA' && tube === 'GREEN')) {
          iceTests.add(test);
          if (test === 'LACTATE') isLactate = true;
        }
      });

      if (requests.includes('HBA1C')) rems.add("HbA1c: Fill to the line.");
      if (requests.includes('ESR')) rems.add("ESR: Requires 2–4mL of blood and cannot use a microtainer.");
    });

    if (bcsCount > 0) {
      if (!matDetails['SPECIAL BOTTLE']) matDetails['SPECIAL BOTTLE'] = { count: 0, tests: [] };
      matDetails['SPECIAL BOTTLE'].count = bcsCount * 2;
      matDetails['SPECIAL BOTTLE'].tests = [`Blood CS (Total Forms: ${bcsCount})`];
    }

    // Ice Reminders
    if (iceTests.size > 0) {
      if (isLactate) {
        criticalRems.push({ text: "LACTATE COLLECTION: Do NOT tourniquet. Can use arterial blood. Send immediately on ice!", critical: true, type: 'ICE' });
        if (iceTests.size > 1) {
          criticalRems.push({ text: "ICE TRANSPORT: Use solid ice, place green top in glove. SEND IMMEDIATELY.", critical: true, type: 'ICE' });
        }
      } else {
        criticalRems.push({ text: `ICE TRANSPORT: For ${Array.from(iceTests).join(' and ')} (Green Top), use solid crushed ice.`, critical: true, type: 'ICE' });
      }
    }

    // ABG
    if (unstructured.toUpperCase().includes('ABG') || unstructured.toUpperCase().includes('VBG')) {
      criticalRems.push({ text: "For ABG/VBG: Use 1cc tuberculin needle with 0.1 mL heparin, send with details written on a micropore.", critical: true, type: 'ABG' });
    }

    // NucMed & MRL
    const now = new Date();
    const day = now.getDay();
    const hour = now.getHours();

    const nucMedTests = activeForms.filter(f => f.form_type.toUpperCase() === 'NUCLEAR MEDICINE');
    if (nucMedTests.length > 0) {
      const open = hour >= 7 && hour < 9;
      const status = open ? "OPEN (7-9 AM)" : "CLOSED (7-9 AM)";
      criticalRems.push({ text: `NUCMED REQUESTED: ${status}`, critical: true, type: 'NUCMED' });
    }

    const mrlTests = activeForms.filter(f => f.form_type.toUpperCase() === 'MRL');
    if (mrlTests.length > 0) {
      const weekday = day >= 1 && day <= 5;
      const open = weekday && hour >= 8 && hour < 16;
      const cutoff = weekday && hour >= 15;
      let status = "CLOSED";
      if (!weekday) status = "CLOSED (Weekend)";
      else if (cutoff) status = "CLOSED (Cut-off: 3 PM)";
      else if (open) status = "OPEN (8 AM - 4 PM)";
      criticalRems.push({ text: `MRL REQUESTED: ${status}`, critical: true, type: 'MRL' });
    }

    setMaterials(matDetails);
    setReminders([...criticalRems, ...Array.from(rems).map(r => ({ text: r, critical: false }))]);
  };

  const updateForm = (index: number, updatedForm: LabRequest) => {
    const newForms = [...forms];
    newForms[index] = updatedForm;
    setForms(newForms);
    calculateMaterialsAndReminders(newForms);
  };

  const [mode, setMode] = useState<'needs' | 'generator'>('needs');

  const handlePrint = () => {
    try {
      window.print();
    } catch (error) {
      console.error("Print error:", error);
      alert("Print failed. If you are using Google AI Studio, try opening the app in a new tab using the button at the top right of the preview.");
    }
  };

  return (
    <div id="form-tool-content" className="tool-content active">
      <div className="input-section">
        <div id="title-logo-wrapper">
          <ClipboardList className="w-10 h-10 mr-3 text-[#334155]" />
          <h2 className="text-xl md:text-2xl">Lab Needs Assistant</h2>
        </div>

        {/* Giant Mode Switch */}
        <div className="flex justify-center mb-4">
          <div className="bg-white p-1 rounded-full flex w-full max-w-[400px] shadow-md relative overflow-hidden border border-slate-200">
            <div 
              className={`absolute top-1 bottom-1 w-[calc(50%-4px)] bg-[#334155] rounded-full transition-all duration-500 cubic-bezier(0.4, 0, 0.2, 1) shadow-lg ${mode === 'generator' ? 'translate-x-[calc(100%+4px)]' : 'translate-x-0'}`}
            />
            <button 
              onClick={() => setMode('needs')}
              className={`mode-switch-btn flex-1 py-1.5 md:py-2 rounded-full text-[10px] md:text-[11px] font-bold z-10 transition-colors duration-500 border-none cursor-pointer bg-transparent !shadow-none !translate-y-0 leading-none ${mode === 'needs' ? 'text-white' : 'text-slate-500 hover:text-slate-700'}`}
            >
              LAB NEEDS MODE
            </button>
            <button 
              onClick={() => setMode('generator')}
              className={`mode-switch-btn flex-1 py-1.5 md:py-2 rounded-full text-[10px] md:text-[11px] font-bold z-10 transition-colors duration-500 border-none cursor-pointer bg-transparent !shadow-none !translate-y-0 leading-none ${mode === 'generator' ? 'text-white' : 'text-slate-500 hover:text-slate-700'}`}
            >
              LAB GENERATOR MODE
            </button>
          </div>
        </div>

        {mode === 'needs' ? (
          /* Lab Needs Mode */
          <div className="animate-in fade-in duration-500">
            <div className="flex flex-col md:flex-row gap-6 mb-6 w-full items-stretch">
              {/* Column 1: Input (1/3) */}
              <div className="w-full md:w-1/3 flex flex-col">
                <div className="flex justify-between items-center mb-2">
                  <label className="text-sm md:text-base font-bold text-[#334155]">Labs Request List</label>
                  <button 
                    onClick={() => setShowLookup(true)}
                    className="text-[10px] md:text-xs bg-[#334155] text-white px-3 py-1 rounded-full hover:bg-opacity-90 transition-all"
                  >
                    Lookup Table
                  </button>
                </div>
                <textarea 
                  className="flex-grow !h-full text-base md:text-lg p-3 min-h-[125px] md:min-h-[250px]"
                  placeholder={"CBC\nUrinalysis"}
                  value={manualLabs}
                  onChange={(e) => setManualLabs(e.target.value)}
                />
              </div>

              {/* Column 2: Materials (1/3) */}
              <div className="w-full md:w-1/3">
                <div className="materials-estimation-box h-full">
                  <div id="materials-estimation">
                    <h3 className="text-[#334155] mt-0 mb-3 text-base md:text-lg border-b border-dotted border-[#ced4da] pb-2 font-bold">
                      📦 Estimated Materials
                    </h3>
                    <div className="material-column">
                      {Object.keys(materials).length > 0 ? (
                        <ul className="list-none p-0 m-0 space-y-2">
                          {(Object.entries(materials) as [string, MaterialDetail][])
                            .sort(([a], [b]) => {
                              if (a === 'Unidentified request') return 1;
                              if (b === 'Unidentified request') return -1;
                              return a.localeCompare(b);
                            })
                            .map(([key, matDetail]) => {
                              const count = matDetail.count;
                              if (count === 0) return null;
                              
                              let materialName;
                              let colorClass = `tube-color-${key.replace(/\s/g, '-').toUpperCase()}`;
                              
                              if (key.includes('SPECIAL BOTTLE')) {
                                materialName = (count === 1 ? 'BCS BOTTLE' : 'BCS BOTTLES');
                                colorClass = 'tube-color-BROWN'; 
                              } else if (key.includes('4 SPECIAL TUBES')) {
                                materialName = (count === 1 ? 'SPECIAL TUBE' : 'SPECIAL TUBES');
                                materialName = `4 ${materialName}`;
                                colorClass = 'tube-color-GREY'; 
                              } else if (key === 'SPECIMEN CUP') {
                                materialName = (count === 1 ? 'SPECIMEN CUP' : 'SPECIMEN CUPS');
                                colorClass = 'tube-color-SPECIMEN-CUP';
                              } else if (key.toUpperCase().includes('SYRINGE')) {
                                materialName = (count === 1 ? 'SYRINGE' : 'SYRINGES');
                                materialName = `${key}`;
                                colorClass = 'tube-color-LIGHT-BLUE';
                              } else if (key === 'Unidentified request') {
                                materialName = 'Unidentified request';
                                colorClass = 'tube-color-BLACK';
                              } else {
                                materialName = (count === 1 ? 'TOP' : 'TOPS'); 
                                materialName = `${key} ${materialName}`;
                              }

                              const hoverTitle = matDetail.tests.map((t, i) => `${i + 1}. ${t}`).join('\n');

                              return (
                                <li key={key} className="flex flex-col py-1 border-b border-gray-100 last:border-0">
                                  <div className="flex items-center gap-2 group">
                                    <span 
                                      className={`${colorClass} cursor-pointer hover:opacity-80 transition-all flex items-center justify-between w-full font-bold text-base md:text-lg`}
                                      title={hoverTitle}
                                      onClick={() => setExpandedMaterials(prev => ({ ...prev, [key]: !prev[key] }))}
                                    >
                                      <span>{count} {materialName}</span>
                                      <svg 
                                        className={`w-4 h-4 transition-transform ${expandedMaterials[key] ? 'rotate-180' : ''}`} 
                                        fill="none" 
                                        stroke="currentColor" 
                                        viewBox="0 0 24 24"
                                      >
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                                      </svg>
                                    </span>
                                  </div>
                                  {expandedMaterials[key] && (
                                    <ul className="ml-4 mt-0 list-disc bg-transparent p-0">
                                      {matDetail.tests.map((t, i) => (
                                        <li key={i} className="text-[15px] text-gray-500 mb-0 ml-4 leading-none font-normal">
                                          {t}
                                        </li>
                                      ))}
                                    </ul>
                                  )}
                                </li>
                              );
                            })}
                        </ul>
                      ) : (
                        <p className="text-[10px] md:text-[11px] text-gray-500">No materials estimated yet. Enter labs above.</p>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Column 3: Reminders (1/3) */}
              <div className="w-full md:w-1/3">
                <div className="reminders-section-box h-full">
                  <div id="reminders-section">
                    <h3 className="text-[#334155] mt-0 mb-3 text-base md:text-lg border-b border-dotted border-[#ced4da] pb-2 font-bold">
                      ⚠️ Important Reminders
                    </h3>
                    <ul className="list-disc list-inside space-y-2 text-sm md:text-base">
                      {reminders.length > 0 ? (
                        reminders.map((rem, idx) => (
                          <li key={idx} className={`${rem.critical ? "critical-reminder text-red-600" : "text-gray-700"} leading-tight`}>
                            {rem.text}
                          </li>
                        ))
                      ) : (
                        <li className="text-gray-500 text-[10px] md:text-[11px] list-none">No reminders at this time.</li>
                      )}
                    </ul>
                  </div>
                </div>
              </div>
            </div>
          </div>
        ) : (
          /* Lab Request Generator Mode */
          <div className="animate-in slide-in-from-right-4 duration-500">
            <div id="collector-control" className="flex flex-wrap gap-3 md:gap-5 mb-6 p-4 bg-gray-50 rounded-lg border border-gray-200">
              <div className="flex items-center w-full md:w-auto">
                <label className="control-label min-w-[100px] md:min-w-0 text-xs md:text-sm">Collected By:</label>
                <input 
                  type="text" 
                  className="control-input flex-grow md:flex-initial text-sm" 
                  placeholder="CLK/INT ____"
                  value={collector}
                  onChange={(e) => setCollector(e.target.value)}
                />
              </div>
              <div className="flex items-center w-full md:w-auto">
                <label className="control-label min-w-[100px] md:min-w-0 text-xs md:text-sm">Time Collected:</label>
                <input 
                  type="text" 
                  className="control-input !w-full md:!w-[120px] flex-grow md:flex-initial text-sm" 
                  placeholder="HH:MM am/pm"
                  value={timeCollected}
                  onChange={(e) => setTimeCollected(e.target.value)}
                />
              </div>
              <div className="flex items-center w-full md:w-auto justify-between md:justify-start">
                <span className="control-label mr-2.5 text-xs md:text-sm">ER Override:</span>
                <label className="toggle-switch">
                  <input type="checkbox" checked={isEr} onChange={(e) => setIsEr(e.target.checked)} />
                  <span className="slider round"></span>
                </label>
              </div>
            </div>

            <div className="flex flex-col md:flex-row gap-6 mb-6">
              {/* Raw Data Column */}
              <div className="flex-1">
                <p className="instruction-text2 !mt-0 mb-2 text-sm md:text-base">Raw Data Input</p>
                <textarea 
                  className="!h-[200px] md:!h-[350px] text-sm md:text-base"
                  placeholder='Example: Patient Jane Doe, 45/F, Ward Bed 3, 1979-11-20
CBC
Urinalysis
Na,K,Cl'
                  value={unstructured}
                  onChange={(e) => setUnstructured(e.target.value)}
                />
                <div className="flex items-center gap-3">
                  <button onClick={handleAutoFill} disabled={loading} className="bg-[#334155] text-white px-6 py-3 rounded-full font-bold hover:bg-opacity-90 transition-all flex-grow text-sm md:text-base">
                    {loading ? "Processing..." : "Auto-Fill from Raw Data"}
                  </button>
                  {loading && (
                    <div id="api-loading-status" className="flex items-center gap-2 text-[#334155] font-medium text-xs">
                      <div className="loader"></div>
                    </div>
                  )}
                </div>
              </div>

              {/* Manual Input Column */}
              <div className="flex-1 bg-gray-50 p-4 rounded-xl border border-gray-200">
                <div className="flex justify-between items-center mb-4">
                  <p className="instruction-text3 !mt-0 text-sm md:text-base">Manual Patient Details</p>
                  <button 
                    onClick={() => setShowLookup(true)}
                    className="text-[10px] md:text-xs bg-[#334155] text-white px-2 py-1 rounded hover:bg-opacity-90 transition-all"
                  >
                    Lookup Table
                  </button>
                </div>
                <div className="grid grid-cols-1 gap-4">
                  <div className="flex flex-col">
                    <label className="text-[10px] md:text-xs font-bold text-[#334155] mb-1 uppercase tracking-wider">Full Name</label>
                    <input 
                      type="text" 
                      className="p-3 md:p-2 border border-[#ced4da] rounded text-sm md:text-base"
                      value={manualName}
                      onChange={(e) => setManualName(e.target.value)}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="flex flex-col">
                      <label className="text-[10px] md:text-xs font-bold text-[#334155] mb-1 uppercase tracking-wider">Location</label>
                      <input 
                        type="text" 
                        className="p-3 md:p-2 border border-[#ced4da] rounded text-sm md:text-base"
                        value={manualLocation}
                        onChange={(e) => setManualLocation(e.target.value)}
                      />
                    </div>
                    <div className="flex flex-col">
                      <label className="text-[10px] md:text-xs font-bold text-[#334155] mb-1 uppercase tracking-wider">Case Number</label>
                      <input 
                        type="text" 
                        className="p-3 md:p-2 border border-[#ced4da] rounded text-sm md:text-base"
                        value={manualCN}
                        onChange={(e) => setManualCN(e.target.value)}
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-4">
                    <div className="flex flex-col">
                      <label className="text-[10px] md:text-xs font-bold text-[#334155] mb-1 uppercase tracking-wider">Age</label>
                      <input 
                        type="text" 
                        className="p-3 md:p-2 border border-[#ced4da] rounded text-sm md:text-base"
                        value={manualAge}
                        onChange={(e) => setManualAge(e.target.value)}
                      />
                    </div>
                    <div className="flex flex-col">
                      <label className="text-[10px] md:text-xs font-bold text-[#334155] mb-1 uppercase tracking-wider">Sex</label>
                      <div className="flex items-center gap-3 h-[46px] md:h-[38px]">
                        <label className="flex items-center gap-1 cursor-pointer text-xs md:text-sm text-[#334155]">
                          <input type="radio" name="sex" value="M" checked={manualSex === 'M'} onChange={(e) => setManualSex(e.target.value)} className="accent-[#334155]" /> M
                        </label>
                        <label className="flex items-center gap-1 cursor-pointer text-xs md:text-sm text-[#334155]">
                          <input type="radio" name="sex" value="F" checked={manualSex === 'F'} onChange={(e) => setManualSex(e.target.value)} className="accent-[#334155]" /> F
                        </label>
                      </div>
                    </div>
                    <div className="flex flex-col">
                      <label className="text-[10px] md:text-xs font-bold text-[#334155] mb-1 uppercase tracking-wider">Birthday</label>
                      <input 
                        type="text" 
                        placeholder="MM/DD/YYYY"
                        className="p-3 md:p-2 border border-[#ced4da] rounded text-xs md:text-sm"
                        value={manualBirthday}
                        onChange={(e) => setManualBirthday(e.target.value)}
                      />
                    </div>
                  </div>
                  <div className="flex flex-col">
                    <label className="text-[10px] md:text-xs font-bold text-[#334155] mb-1 uppercase tracking-wider">Labs (Requests List)</label>
                    <textarea 
                      className="p-3 md:p-2 border border-[#ced4da] rounded text-sm md:text-base !h-[100px] md:!h-[150px]"
                      placeholder={"CBC\nUrinalysis"}
                      value={manualLabs}
                      onChange={(e) => setManualLabs(e.target.value)}
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Materials & Reminders in Generator Mode */}
            <div className="materials-and-reminders-group flex flex-col md:flex-row gap-4 mb-6">
              <div className="materials-estimation-box w-full md:w-1/3">
                <div id="materials-estimation">
                  <h3 className="text-[#334155] mt-0 mb-3 text-base md:text-lg border-b border-dotted border-[#ced4da] pb-2 font-bold">
                    📦 Estimated Materials
                  </h3>
                  <div className="material-column">
                    {Object.keys(materials).length > 0 ? (
                      <ul className="list-none p-0 m-0 space-y-2">
                        {(Object.entries(materials) as [string, MaterialDetail][])
                          .sort(([a], [b]) => {
                            if (a === 'Unidentified request') return 1;
                            if (b === 'Unidentified request') return -1;
                            return a.localeCompare(b);
                          })
                          .map(([key, matDetail]) => {
                            const count = matDetail.count;
                            if (count === 0) return null;
                            
                            let materialName;
                            let colorClass = `tube-color-${key.replace(/\s/g, '-').toUpperCase()}`;
                            
                            if (key.includes('SPECIAL BOTTLE')) {
                              materialName = (count === 1 ? 'BCS BOTTLE' : 'BCS BOTTLES');
                              colorClass = 'tube-color-BROWN'; 
                            } else if (key.includes('4 SPECIAL TUBES')) {
                              materialName = (count === 1 ? 'SPECIAL TUBE' : 'SPECIAL TUBES');
                              materialName = `4 ${materialName}`;
                              colorClass = 'tube-color-GREY'; 
                            } else if (key === 'SPECIMEN CUP') {
                              materialName = (count === 1 ? 'SPECIMEN CUP' : 'SPECIMEN CUPS');
                              colorClass = 'tube-color-SPECIMEN-CUP';
                            } else if (key.toUpperCase().includes('SYRINGE')) {
                              materialName = (count === 1 ? 'SYRINGE' : 'SYRINGES');
                              materialName = `${key}`;
                              colorClass = 'tube-color-LIGHT-BLUE';
                            } else if (key === 'Unidentified request') {
                              materialName = 'Unidentified request';
                              colorClass = 'tube-color-BLACK';
                            } else {
                              materialName = (count === 1 ? 'TOP' : 'TOPS'); 
                              materialName = `${key} ${materialName}`;
                            }

                            return (
                              <li key={key} className="flex flex-col py-1 border-b border-gray-100 last:border-0">
                                <div className="flex items-center gap-2">
                                  <span className={`${colorClass} flex items-center justify-between w-full font-bold text-sm md:text-base`}>
                                    <span>{count} {materialName}</span>
                                  </span>
                                </div>
                              </li>
                            );
                          })}
                      </ul>
                    ) : (
                      <p className="text-[10px] md:text-[11px] text-gray-500">No materials estimated yet.</p>
                    )}
                  </div>
                </div>
              </div>

              <div className="reminders-section-box w-full md:w-2/3">
                <div id="reminders-section">
                  <h3 className="text-[#334155] mt-0 mb-3 text-base md:text-lg border-b border-dotted border-[#ced4da] pb-2 font-bold">
                    ⚠️ Important Reminders
                  </h3>
                  <ul className="list-disc list-inside space-y-1 text-xs md:text-sm">
                    {reminders.length > 0 ? (
                      reminders.map((rem, idx) => (
                        <li key={idx} className={`${rem.critical ? "critical-reminder text-red-600" : "text-gray-700"} leading-tight`}>
                          {rem.text}
                        </li>
                      ))
                    ) : (
                      <li className="text-gray-500 text-[10px] md:text-[11px] list-none">No reminders.</li>
                    )}
                  </ul>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Lookup Table Modal */}
        {showLookup && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-2 md:p-4">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl max-h-[90vh] md:max-h-[80vh] flex flex-col overflow-hidden">
              <div className="p-4 border-bottom flex flex-col gap-3 bg-[#f8fafc]">
                <div className="flex justify-between items-center">
                  <h3 className="font-bold text-[#1e293b]">Lab Test Lookup Table</h3>
                  <button 
                    onClick={() => setShowLookup(false)}
                    className="text-gray-500 hover:text-gray-700 text-2xl font-bold p-2"
                  >
                    &times;
                  </button>
                </div>
                <div className="relative">
                  <input
                    type="text"
                    placeholder="Search test name, specimen, or alias..."
                    className="w-full p-3 md:p-2 pl-10 md:pl-8 border border-[#ced4da] rounded-lg text-base md:text-sm focus:ring-2 focus:ring-[#334155] focus:outline-none"
                    value={lookupSearch}
                    onChange={(e) => setLookupSearch(e.target.value)}
                  />
                  <svg className="absolute left-3 top-3.5 md:top-2.5 h-5 w-5 md:h-4 md:w-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                </div>
              </div>
              <div className="overflow-auto p-2 md:p-4">
                <table className="w-full text-left text-sm border-collapse">
                  <thead className="sticky top-0 bg-white shadow-sm z-10">
                    <tr>
                      <th className="p-2 border-b-2 border-gray-200 font-bold text-[#334155]">Test Name</th>
                      <th className="p-2 border-b-2 border-gray-200 font-bold text-[#334155] hidden md:table-cell">Specimen</th>
                      <th className="p-2 border-b-2 border-gray-200 font-bold text-[#334155]">Container</th>
                      <th className="p-2 border-b-2 border-gray-200 font-bold text-[#334155]">Laboratory</th>
                    </tr>
                  </thead>
                  <tbody>
                    {getParsedLookup().filter(entry => {
                      const search = lookupSearch.toLowerCase().trim();
                      if (!search) return true;

                      const name = entry.testName.toLowerCase();
                      const spec = entry.specimen.toLowerCase();
                      const form = entry.formType.toLowerCase();
                      
                      const isMatch = (text: string, term: string) => {
                        if (term.length <= 2) {
                          const regex = new RegExp(`\\b${term}\\b`, 'i');
                          return regex.test(text);
                        }
                        return text.includes(term);
                      };

                      const aliases: Record<string, string[]> = {
                        'na': ['sodium'], 'k': ['potassium'], 'cl': ['chloride'], 'ca': ['calcium'],
                        'mg': ['magnesium'], 'phos': ['phosphorus', 'po4'], 'fbs': ['sugar', 'glucose'],
                        'bua': ['uric acid'], 'crea': ['creatinine'], 'ua': ['urinalysis'],
                        'fecalysis': ['stool exam', 'stool analysis'], 'cbc': ['complete blood count'],
                        'tpag': ['albumin globulin'], 'trop i': ['troponin'], 'hba1c': ['glycated hemoglobin'],
                        'ogtt': ['glucose tolerance'],
                      };

                      const matchAlias = Object.entries(aliases).some(([key, vals]) => {
                        if (isMatch(name, key)) return vals.some(v => isMatch(v, search));
                        if (isMatch(key, search)) return vals.some(v => isMatch(name, v));
                        return false;
                      });

                      return isMatch(name, search) || isMatch(spec, search) || isMatch(form, search) || matchAlias;
                    }).map((entry, idx) => (
                      <tr key={idx} className="hover:bg-gray-50 border-b border-gray-100">
                        <td className="p-2 font-medium">{entry.testName}</td>
                        <td className="p-2 hidden md:table-cell">{entry.specimen}</td>
                        <td className="p-2">
                          {CUP_SPECIMENS.includes(entry.specimen.toLowerCase()) ? 'Cup' : (entry.top === 'N/A' ? 'N/A' : `${entry.top}`)}
                        </td>
                        <td className="p-2">{entry.formType}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="p-4 border-t bg-[#f8fafc] flex justify-end">
                <button 
                  onClick={() => setShowLookup(false)}
                  className="bg-[#334155] text-white px-6 py-3 md:py-2 rounded-lg font-bold w-full md:w-auto"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {mode === 'generator' && (
        <>
          <div className="form-header-container">
            <h2>Generated Form Previews</h2>
            <button 
              onClick={handlePrint}
              className="bg-[#334155] text-white px-4 py-2 rounded-lg font-bold flex items-center gap-2 hover:bg-[#475569] transition-colors shadow-md"
            >
              🖨️ Print Forms (Final Step)
            </button>
          </div>

          <div id="preview-instructions" className="bg-white border border-[#ced4da] p-[15px] rounded-lg my-5 shadow-[0_6px_15px_rgba(0,0,0,0.05)]">
            <p className="text-base mt-1.25 text-[#374151]">
              <strong>• Edit Text:</strong> Click any text box on the forms to make final adjustments.
            </p>
            <p className="text-base mt-1.25 text-[#374151]">
              <strong>• Change Font Size:</strong> Double-click any text box. A size input will pop out.
            </p>
            <p className="text-base mt-1.25 text-[#374151]">
              <strong>• Printing:</strong> Set scale to 88% and ensure paper size is A4.
            </p>
          </div>

          <div className="form-previews flex flex-wrap gap-[15px] p-0 justify-start print-content">
            {forms.map((form, idx) => (
              <LabForm key={idx} form={form} onUpdate={(updated) => updateForm(idx, updated)} />
            ))}
          </div>
        </>
      )}
    </div>
  );
};

export default TalongTab;
