

import React, { useEffect, useState } from 'react';

const API = import.meta.env.VITE_API_URL || 'http://127.0.0.1:5000/api';

const TN_DISTRICT_YIELDS = {

  Ariyalur: 1650,

  Chengalpattu: 1500,

  Chennai: 1500,

  Coimbatore: 1550,

  Cuddalore: 1500,

  Dharmapuri: 1600,

  Dindigul: 1600,

  Erode: 1600,

  Kallakurichi: 1550,

  Kancheepuram: 1550,

  Kanniyakumari: 1450,

  Karur: 1650,

  Krishnagiri: 1550,

  Madurai: 1650,

  Mayiladuthurai: 1500,

  Nagapattinam: 1500,

  Namakkal: 1600,

  Nilgiris: 1350,

  Perambalur: 1600,

  Pudukkottai: 1600,

  Ramanathapuram: 1650,

  Ranipet: 1550,

  Salem: 1600,

  Sivaganga: 1650,

  Tenkasi: 1550,

  Thanjavur: 1550,

  Theni: 1600,

  Thoothukudi: 1650,

  Tiruchirappalli: 1600,

  Tirunelveli: 1650,

  Tirupathur: 1550,

  Tiruppur: 1600,

  Tiruvallur: 1500,

  Tiruvannamalai: 1550,

  Tiruvarur: 1500,

  Vellore: 1550,

  Viluppuram: 1550,

  Virudhunagar: 1650,

};

const TN_DISTRICTS = Object.keys(TN_DISTRICT_YIELDS);

const COMPANY_PHONE = import.meta.env.VITE_COMPANY_PHONE || '';

const COMPANY_WHATSAPP = import.meta.env.VITE_COMPANY_WHATSAPP || '';

function App() {

  const [capacity, setCapacity] = useState(2);

  const [panelWattage, setPanelWattage] = useState(550);

  const [district, setDistrict] = useState('Ariyalur');

  const [lead, setLead] = useState({

    name: '',

    phone: '',

    email: '',

    district: 'Ariyalur',

    monthly_bill: '',

    message: '',

    consent: false,

  });

  const [notice, setNotice] = useState('');

  const [chatOpen, setChatOpen] = useState(false);

  const [chatText, setChatText] = useState('');

  const [chatMessages, setChatMessages] = useState([

    {

      role: 'assistant',

      text: 'Hello! I can help you understand rooftop solar, compare panels, estimate generation, or request a callback. What would you like to know?',

    },

  ]);

  const [chatLead, setChatLead] = useState({
    name: '',
    phone: '',
    email: '',
    district: '',
    consent: false,
  });

  const [chatIntakeStep, setChatIntakeStep] = useState('first-message');

  const [chatLeadDraft, setChatLeadDraft] = useState({ name: '', phone: '', email: '', district: '' });

  const [firstChatMessage, setFirstChatMessage] = useState('');

  const [adminOpen, setAdminOpen] = useState(false);

  const [adminToken, setAdminToken] = useState(

    sessionStorage.getItem('solarAdminToken') || ''

  );

  const [credentials, setCredentials] = useState({

    username: '',

    password: '',

  });

  const [adminTab, setAdminTab] = useState('leads');

  const [leads, setLeads] = useState([]);

  const [adminPanels, setAdminPanels] = useState([]);

  const [activity, setActivity] = useState([]);

  const [loadingAdmin, setLoadingAdmin] = useState(false);

  const annualYield = TN_DISTRICT_YIELDS[district] ?? 1500;

  const annualUnits = capacity * annualYield;

  const panelCount = Math.ceil((capacity * 1000) / panelWattage);

  const monthlyUnits = annualUnits / 12;

  const dailyUnits = annualUnits / 365;

  useEffect(() => {

    const handler = (event) => {

      if (

        event.ctrlKey &&

        event.shiftKey &&

        event.key.toLowerCase() === 'a'

      ) {

        event.preventDefault();

        setAdminOpen(true);

      }

      if (event.key === 'Escape') {

        setChatOpen(false);

        setAdminOpen(false);

      }

    };

    window.addEventListener('keydown', handler);

    return () => window.removeEventListener('keydown', handler);

  }, []);

  async function submitLead(event) {

    event.preventDefault();

    setNotice('');

    try {

      const res = await fetch(`${API}/leads`, {

        method: 'POST',

        headers: { 'Content-Type': 'application/json' },

        body: JSON.stringify({ ...lead, source: 'website' }),

      });

      const data = await res.json();

      if (!res.ok) {

        throw new Error(data.error || 'Could not send your enquiry.');

      }

      setNotice(

        'Thank you! Your enquiry has been saved. Our team can follow up with you.'

      );

      setLead({

        name: '',

        phone: '',

        email: '',

        district: 'Ariyalur',

        monthly_bill: '',

        message: '',

        consent: false,

      });

    } catch (err) {

      setNotice(`${err.message} Is the Flask backend running?`);

    }

  }

  async function processChatLeadIntake(text, nextMessages) {
    const answer = text.trim();
    const lower = answer.toLowerCase();
    const reply = (message) => setChatMessages([...nextMessages, { role: 'assistant', text: message }]);

    if (/^(cancel|stop|skip this)$/i.test(lower)) {
      setChatIntakeStep('idle');
      setChatLeadDraft({ name: '', phone: '', email: '', district: '' });
      reply('No problem. I have not saved your details. You can keep asking me solar questions.');
      return;
    }

    if (chatIntakeStep === 'name') {
      if (answer.length < 2 || answer.length > 100) {
        reply('Please enter a name between 2 and 100 characters.');
        return;
      }
      setChatLeadDraft((draft) => ({ ...draft, name: answer }));
      setChatIntakeStep('phone');
      reply('Thanks! What phone number is best for our solar team to reach you?');
      return;
    }

    if (chatIntakeStep === 'phone') {
      const phone = answer.replace(/\s+/g, ' ');
      if (!/^[0-9+()\- ]{8,20}$/.test(phone)) {
        reply('Please enter a valid phone number, including the area or country code if needed.');
        return;
      }
      setChatLeadDraft((draft) => ({ ...draft, phone }));
      setChatIntakeStep('district');
      reply('Which district is the property in? You can type “skip” if you prefer not to say.');
      return;
    }

    if (chatIntakeStep === 'district') {
      if (answer.length > 100) {
        reply('Please enter a shorter district name, or type “skip”.');
        return;
      }
      setChatLeadDraft((draft) => ({ ...draft, district: /^(skip|not sure)$/i.test(answer) ? '' : answer }));
      setChatIntakeStep('email');
      reply('Would you like to share an email address as well? Type it in, or say “skip”.');
      return;
    }

    if (chatIntakeStep === 'email') {
      const email = /^(skip|no|none)$/i.test(answer) ? '' : answer;
      if (email && (email.length > 160 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))) {
        reply('That email does not look valid. Please try again or say “skip”.');
        return;
      }
      setChatLeadDraft((draft) => ({ ...draft, email }));
      setChatIntakeStep('consent');
      reply('May Five and Two Energy Solutions contact you about your enquiry? Your details are only saved if you say yes. Please answer yes or no.');
      return;
    }

    if (chatIntakeStep === 'consent') {
      if (/^(no|n)$/i.test(lower)) {
        setChatIntakeStep('idle');
        setChatLeadDraft({ name: '', phone: '', email: '', district: '' });
        reply('Understood. I have not saved your contact details. You can continue chatting with me.');
        return;
      }
      if (!/^(yes|y|sure|okay|ok|i agree|agree)$/i.test(lower)) {
        reply('Please answer yes if you agree to be contacted, or no if you do not.');
        return;
      }
      try {
        const res = await fetch(`${API}/leads`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            ...chatLeadDraft,
            source: 'chatbot',
            message: firstChatMessage || 'Solar enquiry through website chatbot',
            consent: true,
          }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Could not save your enquiry.');
        setChatIntakeStep('idle');
        setChatLeadDraft({ name: '', phone: '', email: '', district: '' });
        reply('Thank you! Your details have been saved, and our solar team will be in touch.');
      } catch (err) {
        reply(`${err.message} Your details have not been saved. Please answer “yes” again to retry, or type “cancel”.`);
      }
    }
  }

  async function sendChat(event) {
    event.preventDefault();
    const text = chatText.trim();
    if (!text) return;
    const next = [...chatMessages, { role: 'user', text }];
    setChatMessages(next);
    setChatText('');

    if (chatIntakeStep !== 'first-message' && chatIntakeStep !== 'idle') {
      await processChatLeadIntake(text, next);
      return;
    }

    const isFirstMessage = chatIntakeStep === 'first-message';
    const isCallbackRequest = /^(i would like a callback|request a callback|callback|request callback)$/i.test(text);
    if (isCallbackRequest) {
      setFirstChatMessage(text);
      setChatLeadDraft({ name: '', phone: '', email: '', district: '' });
      setChatIntakeStep('name');
      setChatMessages([...next, { role: 'assistant', text: 'I can arrange a callback. What name should we use for your request?' }]);
      return;
    }

    try {
      const res = await fetch(`${API}/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: text }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Chat request failed.');
      const answer = {
        role: 'assistant',
        text: data.reply || 'I can help with panel comparisons, generation estimates, schemes, or a callback request.',
        sources: Array.isArray(data.sources) ? data.sources : [],
      };
      const responseMessages = [...next, answer];
      if (isFirstMessage) {
        setFirstChatMessage(text);
        setChatLeadDraft({ name: '', phone: '', email: '', district: '' });
        setChatIntakeStep('name');
        responseMessages.push({ role: 'assistant', text: 'To help our solar team follow up on your enquiry, what name should we use?' });
      }
      setChatMessages(responseMessages);
    } catch {
      const responseMessages = [...next, {
        role: 'assistant',
        text: 'I can answer common questions about solar panels, estimated generation, and government schemes. For a personalised quote, please use the enquiry form below.',
      }];
      if (isFirstMessage) {
        setFirstChatMessage(text);
        setChatLeadDraft({ name: '', phone: '', email: '', district: '' });
        setChatIntakeStep('name');
        responseMessages.push({ role: 'assistant', text: 'To help our solar team follow up on your enquiry, what name should we use?' });
      }
      setChatMessages(responseMessages);
    }
  }
  async function submitChatLead(event) {

    event.preventDefault();

    try {

      const res = await fetch(`${API}/leads`, {

        method: 'POST',

        headers: { 'Content-Type': 'application/json' },

        body: JSON.stringify({

          ...chatLead,

          source: 'chatbot',

          message: 'Callback requested through website chatbot',

        }),

      });

      const data = await res.json();

      if (!res.ok) {

        throw new Error(data.error || 'Could not save callback request.');

      }

      setChatMessages((prev) => [

        ...prev,

        {

          role: 'assistant',

          text: 'Thanks! Your callback request has been recorded.',

        },

      ]);

      setChatLead({

        name: '',

        phone: '',

        email: '',

        district: '',

        consent: false,

      });

    } catch (err) {

      setChatMessages((prev) => [

        ...prev,

        {

          role: 'assistant',

          text: `${err.message} Please try the enquiry form instead.`,

        },

      ]);

    }

  }
  async function adminLogin(event) {

    event.preventDefault();

    try {

      const res = await fetch(`${API}/admin/login`, {

        method: 'POST',

        headers: { 'Content-Type': 'application/json' },

        body: JSON.stringify(credentials),

      });

      const data = await res.json();

      if (!res.ok) {

        throw new Error(data.error || 'Login failed');

      }

      sessionStorage.setItem('solarAdminToken', data.token);

      setAdminToken(data.token);

      setNotice('Admin login successful.');

    } catch (err) {

      setNotice(err.message);

    }

  }

  async function loadAdminData(token = adminToken) {

    setLoadingAdmin(true);

    try {

      const headers = { Authorization: `Bearer ${token}` };

      const [leadRes, panelRes, activityRes] = await Promise.all([

        fetch(`${API}/admin/leads`, { headers }),

        fetch(`${API}/admin/panels`, { headers }),

        fetch(`${API}/admin/activity`, { headers }),

      ]);

      if (

        [leadRes, panelRes, activityRes].some((res) => res.status === 401)

      ) {

        logoutAdmin();

        throw new Error('Session expired. Please log in again.');

      }

      if (leadRes.ok) setLeads(await leadRes.json());

      if (panelRes.ok) setAdminPanels(await panelRes.json());

      if (activityRes.ok) setActivity(await activityRes.json());

    } catch (err) {

      setNotice(err.message || 'Could not load admin data.');

    } finally {

      setLoadingAdmin(false);

    }

  }

  useEffect(() => {

    if (adminOpen && adminToken) {

      loadAdminData(adminToken);

    }

  }, [adminOpen, adminToken]);

  function logoutAdmin() {

    const token = adminToken;

    if (token) {

      fetch(`${API}/admin/logout`, {

        method: 'POST',

        headers: { Authorization: `Bearer ${token}` },

      }).catch(() => {});

    }

    sessionStorage.removeItem('solarAdminToken');

    setAdminToken('');

    setLeads([]);

    setAdminPanels([]);

    setActivity([]);

  }

  async function updateLeadStatus(id, status) {

    try {

      const res = await fetch(`${API}/admin/leads/${id}`, {

        method: 'PATCH',

        headers: {

          'Content-Type': 'application/json',

          Authorization: `Bearer ${adminToken}`,

        },

        body: JSON.stringify({ status }),

      });

      const data = await res.json();

      if (!res.ok) {

        setNotice(data.error || 'Could not update lead.');

        return;

      }

      await loadAdminData();

    } catch (err) {

      setNotice(err.message || 'Could not update lead.');

    }

  }

  async function updatePanel(panel) {

    try {

      const res = await fetch(`${API}/admin/panels/${panel.id}`, {

        method: 'PUT',

        headers: {

          'Content-Type': 'application/json',

          Authorization: `Bearer ${adminToken}`,

        },

        body: JSON.stringify({

          price: Number(panel.price),

          active: Boolean(panel.active),

        }),

      });

      const data = await res.json();

      if (!res.ok) {

        setNotice(data.error || 'Could not update panel.');

        return;

      }

      setNotice('Panel price updated.');

      await loadAdminData();

    } catch (err) {

      setNotice(err.message || 'Could not update panel.');

    }

  }

  function changeCapacity(nextCapacity) {

    setCapacity(nextCapacity);

  }

  return (

    <>

      <header className="topbar">

        <a className="brand" href="#home">

           <img

            src="/logo.png"

            alt="Five and Two Energy Solutions"

            className="company-logo"

          />

          <span>

            Five and Two <b>Energy Solutions</b>

            <small>POWER YOUR TOMORROW</small>

          </span>

        </a>

        <nav>

          <a href="#solutions">Solutions</a>

          <a href="#panel-guide">Panels</a>

          <a href="#calculator">Calculator</a>

          <a href="#schemes">Government schemes</a>

          <a href="#about">Why solar?</a>

        </nav>

        <a className="button button-gold nav-cta" href="#contact">

          Get a quote <span>↗</span>

        </a>

      </header>

      <main>

        <section className="hero" id="home">

          <div className="hero-copy">

            <div className="eyebrow">

              <span></span> CLEAN ENERGY. SMARTER LIVING.

            </div>

            <h1>

              Make your roof

              <br />

              work for <em>you.</em>

            </h1>

            <p>

              Explore reliable rooftop solar solutions, understand your savings

              potential, and take the first step towards cleaner energy.

            </p>

            <div className="hero-actions">

              <a className="button button-blue" href="#calculator">

                Calculate my solar <span>↗</span>

              </a>

              <a className="text-link" href="#solutions">

                Explore solutions <span>→</span>

              </a>

            </div>

            <div className="hero-proof">

              <div className="proof-icon">✓</div>

              <div>

                <b>Guidance from enquiry to installation</b>

                <small>

                  Clear estimates. Informed decisions. No guaranteed-savings

                  claims.

                </small>

              </div>

            </div>

          </div>

          <div className="hero-art">

            <div className="sun"></div>

            <div className="hero-stats">

              <span>ROOFTOP SOLAR</span>

              <b>

                Energy for

                <br />a brighter future.

              </b>

              <small>Designed around your home.</small>

            </div>

            <div className="roof">

              <div className="roof-panels">

                {Array.from({ length: 12 }, (_, i) => (

                  <i key={i}></i>

                ))}

              </div>

            </div>

            <div className="hero-note">

              <span>↗</span>

              <div>

                <b>Start with an estimate</b>

                <small>System size • Generation • Quote guidance</small>

              </div>

            </div>

          </div>

        </section>

        <section className="trust-strip">

          <div><b>01</b><span>Panel choices for your roof</span></div>

          <div><b>02</b><span>Estimate energy generation</span></div>

          <div><b>03</b><span>Understand eligible schemes</span></div>

          <div><b>04</b><span>Request a callback</span></div>

        </section>

        <section className="section" id="solutions">

          <div className="section-heading">

            <div>

              <div className="eyebrow">SOLAR, MADE SIMPLE</div>

              <h2>Find a solution that<br />fits your <em>home.</em></h2>

            </div>

            <p>

              Explore how the right panel and system design can make better use

              of your roof, then estimate generation for your district.

            </p>

          </div>

          <div className="feature-grid">

            <article className="feature-card feature-blue">

              <span className="feature-icon">⌂</span>

              <h3>Residential rooftop</h3>

              <p>Explore 1 kW, 2 kW and 3 kW starting points for household solar planning.</p>

              <a href="#calculator">Estimate your system ↗</a>

            </article>

            <article className="feature-card feature-gold">

              <span className="feature-icon">▥</span>

              <h3>Panels chosen to fit</h3>

              <p>Understand the details that matter when choosing panels for your home.</p>

              <a href="#panel-guide">See what to consider ↗</a>

            </article>

            <article className="feature-card feature-silver">

              <span className="feature-icon">☼</span>

              <h3>Understand generation</h3>

              <p>Estimate how many units your system may generate over a day, month and year.</p>

              <a href="#calculator">Calculate output ↗</a>

            </article>

          </div>

        </section>

        <section className="calculator-section" id="calculator">
          <div className="section-heading">
            <div>
              <div className="eyebrow">PLAN WITH CONFIDENCE</div>
              <h2>Your solar <em>calculator.</em></h2>
            </div>
            <p>Choose a planning size and district to see an indicative energy estimate. Final system design follows a roof and usage assessment.</p>
          </div>

          <div className="calculator-card">
            <div className="calculator-controls">
              <label>
                Target system size
                <select value={capacity} onChange={(e) => changeCapacity(Number(e.target.value))}>
                  <option value="1">1 kW target</option>
                  <option value="2">2 kW target</option>
                  <option value="3">3 kW target</option>
                </select>
              </label>
              <label>
                Panel rating
                <select value={panelWattage} onChange={(e) => setPanelWattage(Number(e.target.value))}>
                  {[400, 450, 500, 550, 600].map((watts) => (
                    <option key={watts} value={watts}>{watts} W panel</option>
                  ))}
                </select>
              </label>
              <label>
                District / yield profile
                <select value={district} onChange={(e) => setDistrict(e.target.value)}>
                  {TN_DISTRICTS.map((name) => <option key={name} value={name}>{name}</option>)}
                </select>
              </label>
              <div className="calculator-hint">
                Planning size: <b>{capacity} kW</b>. Estimated generation uses the selected district profile of{' '}
                <b>{annualYield.toLocaleString('en-IN')} kWh/kWp/year</b>. Panel count is rounded up from system size ÷ panel rating. These are provisional planning assumptions, not a production guarantee.
              </div>
            </div>

            <div className="calculator-results">
              <div className="result-top">
                <span>YOUR ESTIMATE</span>
                <span className="live-dot">● Indicative</span>
              </div>
              <div className="result-main">
                <small>Selected planning size</small>
                <b>{capacity} kW</b>
                <span>Final size and equipment depend on a site assessment.</span>
              </div>
              <div className="result-metrics">
                <div><span>Estimated panels</span><b>{panelCount} <small>panels</small></b></div>
                <div><span>Panel rating</span><b>{panelWattage} <small>W each</small></b></div>
                <div><span>Daily energy</span><b>{dailyUnits.toFixed(1)} <small>units</small></b></div>
                <div><span>Monthly energy</span><b>{monthlyUnits.toFixed(0)} <small>units</small></b></div>
                <div><span>Annual energy</span><b>{Math.round(annualUnits).toLocaleString('en-IN')} <small>units</small></b></div>
              </div>
              <a
                className="button button-gold full"
                href="#contact"
                onClick={() => setLead((p) => ({
                  ...p,
                  message: `Please contact me about a rooftop solar system around ${capacity} kW in ${district}, estimated at ${panelCount} × ${panelWattage} W panels.`,
                }))}
              >
                Request a tailored quote ↗
              </a>
              <small className="disclaimer">
                {district}, Tamil Nadu yield profile: {annualYield.toLocaleString('en-IN')} kWh/kWp/year. This is a provisional planning assumption, not live weather data or a guaranteed output. Actual generation depends on location, shade, roof direction, weather, system losses and maintenance.
              </small>
            </div>
          </div>
        </section>

        <section className="panel-guide-section" id="panel-guide">
          <div className="section-heading">
            <div>
              <div className="eyebrow">THE RIGHT FIT FOR YOUR HOME</div>
              <h2>Choose panels with <em>confidence.</em></h2>
            </div>
            <p>We’ll help you compare the specifications that affect roof fit, system design and long-term value—and explain them clearly in your quote.</p>
          </div>

          <div className="panel-guide-grid">
            <article className="panel-guide-card">
              <img
                className="panel-guide-photo"
                src="/WhatsApp%20Image%202026-10-16%20at%2010.27.12%20AM.jpeg"
                alt="Solar panels installed across a residential rooftop"
                loading="lazy"
              />
              <div className="panel-guide-copy">
                <span>01 · ROOF FIT</span>
                <h3>Make your roof work smarter</h3>
                <p>Panel dimensions, rated power, shade and usable roof area all matter. We’ll help you understand the trade-offs for your home before recommending a system size.</p>
              </div>
            </article>
            <article className="panel-guide-card">
              <img
                className="panel-guide-photo"
                src="/WhatsApp%20Image%202026-10-16%20at%2010.27.11%20AM.jpeg"
                alt="Several solar panel arrays fitted on a rooftop"
                loading="lazy"
              />
              <div className="panel-guide-copy">
                <span>02 · SYSTEM DESIGN</span>
                <h3>Plan the whole system together</h3>
                <p>Panels are part of a complete setup. We’ll explain how the panel choice fits with the inverter, mounting structure and your household’s energy needs.</p>
              </div>
            </article>
            <article className="panel-guide-card">
              <img
                className="panel-guide-photo"
                src="/WhatsApp%20Image%202026-10-16%20at%2010.27.06%20AM.jpeg"
                alt="Close view of a rooftop solar panel array"
                loading="lazy"
              />
              <div className="panel-guide-copy">
                <span>03 · CLEAR COMPARISON</span>
                <h3>Know what you’re investing in</h3>
                <p>Your proposal should make it easy to review the panel model, rated specifications, applicable warranty terms and complete installation costs before you decide.</p>
              </div>
            </article>
          </div>
          <a className="button button-blue panel-guide-cta" href="#contact">Talk with our solar team ↗</a>
        </section>

        <section className="scheme-section" id="schemes">

          <div className="scheme-copy">

            <div className="eyebrow">PUBLIC SCHEME AWARENESS</div>

            <h2>Know the schemes.<br /><em>Check your eligibility.</em></h2>

            <p>

              Residential rooftop solar support may be available through central

              and state programmes. Eligibility, installation requirements,

              funding and application steps can change; verify before making a

              purchase decision.

            </p>

            <a className="button button-blue" href="https://pmsuryaghar.gov.in/" target="_blank" rel="noreferrer">

              Official PM Surya Ghar portal ↗

            </a>

            <a className="official-link" href="https://www.tnebltd.gov.in/usrp/" target="_blank" rel="noreferrer">

              Tamil Nadu Solar Homes portal ↗

            </a>

          </div>

          <div className="scheme-cards">

            <article>

              <div className="scheme-label">CENTRAL GOVERNMENT</div>

              <h3>PM Surya Ghar: Muft Bijli Yojana</h3>

              <p>

                Central financial assistance for eligible residential rooftop

                solar systems, subject to current programme rules and approved

                installation requirements.

              </p>

              <a href="https://www.pmsuryaghar.gov.in/" target="_blank" rel="noreferrer">Check official details ↗</a>

            </article>

            <article>

              <div className="scheme-label gold-text">TAMIL NADU</div>

              <h3>State top-up information</h3>

              <p>

                The Tamil Nadu Solar Homes portal advertises additional state

                support. Confirm the current Government Order, availability and

                your eligibility directly with the official portal before

                relying on any amount.

              </p>

              <a href="https://www.tnebltd.gov.in/usrp/" target="_blank" rel="noreferrer">Check current state guidance ↗</a>

            </article>

            <div className="scheme-warning">

              Important: Five and Two Energy Solutions is an information

              resource, not a government agency. Scheme amounts shown on this

              website are not guaranteed benefits.

            </div>

          </div>

        </section>

        <section className="why-section" id="about">

          <div className="eyebrow">A CLEARER WAY TO GO SOLAR</div>

          <h2>Make an informed decision,<br /><em>one step at a time.</em></h2>

          <div className="why-grid">

            <div><span>01</span><h3>Understand your usage</h3><p>Start with your bill and roof conditions, not a one-size-fits-all promise.</p></div>

            <div><span>02</span><h3>Compare options</h3><p>Review wattage, pricing and equipment details before requesting a quote.</p></div>

            <div><span>03</span><h3>Check the paperwork</h3><p>Confirm vendor requirements, metering, approvals and scheme eligibility.</p></div>

            <div><span>04</span><h3>Get expert guidance</h3><p>Request a callback so a qualified installer can assess your actual site.</p></div>

          </div>

        </section>

        <section className="contact-section" id="contact">

          <div className="contact-copy">

            <div className="eyebrow">LET'S TALK SOLAR</div>

            <h2>Have a roof?<br />Let's explore its <em>potential.</em></h2>

            <p>

              Tell us a little about your requirements. Your details will be

              used to respond to your enquiry, in line with the site's privacy

              notice.

            </p>

            <div className="contact-points">

              <div><span>✓</span> No obligation to purchase</div>

              <div><span>✓</span> Personalised follow-up</div>

              <div><span>✓</span> Clear next steps</div>

            </div>

          </div>

          <form className="lead-form" onSubmit={submitLead}>

            <div className="form-heading">

              <h3>Request a callback</h3>

              <p>Fields marked * are required.</p>

            </div>

            <div className="form-grid">

              <label>

                Full name *

                <input required minLength="2" maxLength="100" value={lead.name} onChange={(e) => setLead({ ...lead, name: e.target.value })} placeholder="Your name" />

              </label>

              <label>

                Phone number *

                <input required pattern="[0-9+() -]{8,20}" value={lead.phone} onChange={(e) => setLead({ ...lead, phone: e.target.value })} placeholder="Your contact number" />

              </label>

              <label>

                Email (optional)

                <input type="email" value={lead.email} onChange={(e) => setLead({ ...lead, email: e.target.value })} placeholder="you@example.com" />

              </label>

              <label>

                District

                <select value={lead.district} onChange={(e) => setLead({ ...lead, district: e.target.value })}>

                  {TN_DISTRICTS.map((name) => (
                    <option key={name} value={name}>{name}</option>
                  ))}

                </select>

              </label>

              <label>

                Approx. monthly bill (₹)

                <input type="number" min="0" value={lead.monthly_bill} onChange={(e) => setLead({ ...lead, monthly_bill: e.target.value })} placeholder="e.g. 2500" />

              </label>

              <label>

                What do you need?

                <select value={lead.message} onChange={(e) => setLead({ ...lead, message: e.target.value })}>

                  <option value="">Choose a requirement</option>

                  <option>Home rooftop solar</option>

                  <option>Business rooftop solar</option>

                  <option>Panel pricing and comparison</option>

                  <option>Government scheme guidance</option>

                  <option>Site visit / quotation</option>

                </select>

              </label>

            </div>

            <label className="consent">

              <input type="checkbox" required checked={lead.consent} onChange={(e) => setLead({ ...lead, consent: e.target.checked })} />

              I consent to being contacted about this enquiry and understand my information will be stored for follow-up.

            </label>

            <button className="button button-blue full" type="submit">Send enquiry <span>↗</span></button>

            {notice && <p className="notice" role="status">{notice}</p>}

            <small className="privacy-note">

              Please do not submit sensitive identity or financial information.

              Basic spam protection and server-side validation are enabled;

              production deployment should add rate limiting and a full privacy policy.

            </small>

          </form>

        </section>

      </main>

      <footer>

        <a className="brand footer-brand" href="#home">

          <img

            src="/logo.png"

            alt="Five and Two Energy Solutions"

            className="company-logo"

          />

          <span>

            Five and Two <b>Energy Solutions</b>

            <small>POWER YOUR TOMORROW</small>

          </span>

        </a>

        <p>

          Estimates are informational only. Final system design, price,

          generation and subsidy eligibility require professional assessment

          and official verification.

        </p>

        <div className="footer-links">

          <a href="https://pmsuryaghar.gov.in/" target="_blank" rel="noreferrer">PM Surya Ghar</a>

          <a href="https://www.tnebltd.gov.in/usrp/" target="_blank" rel="noreferrer">Tamil Nadu portal</a>

          {COMPANY_PHONE && <a href={`tel:${COMPANY_PHONE}`}>Call us</a>}

          {COMPANY_WHATSAPP && (

            <a

              href={`https://wa.me/${COMPANY_WHATSAPP.replace(/[^0-9]/g, '')}?text=${encodeURIComponent('Hello, I would like to know more about rooftop solar.')}`}

              target="_blank"

              rel="noreferrer"

            >

              WhatsApp

            </a>

          )}

          <button onClick={() => setAdminOpen(true)}>Admin</button>

        </div>

        <small>© {new Date().getFullYear()} Five and Two Energy Solutions · Project starter template</small>

      </footer>

      <button

        className={`chat-launcher ${chatOpen ? 'is-hidden' : ''}`}

        onClick={() => setChatOpen(true)}

        aria-label="Open solar assistant"

      >

        <span>✦</span>

        <span>Ask solar assistant</span>

      </button>

      {chatOpen && (

        <aside className="chat-window" aria-label="Solar assistant">

          <div className="chat-header">

            <div className="chat-avatar">✦</div>

            <div><b>Solar assistant</b><small>Solar questions & callback requests</small></div>

            <button aria-label="Close chatbot" onClick={() => setChatOpen(false)}>×</button>

          </div>

          <div className="chat-messages">

            {chatMessages.map((m, i) => (

              <div key={i} className={`chat-bubble ${m.role}`}>
                {m.text}
                {m.sources?.length > 0 && (
                  <div className="chat-sources">
                    {m.sources.map((source) => (
                      <a key={source.url} href={source.url} target="_blank" rel="noreferrer">{source.title}</a>
                    ))}
                  </div>
                )}
              </div>

            ))}

            <div className="chat-quick">

              <button onClick={() => setChatText('How much energy can a 2 kW system generate?')}>Energy estimate</button>

              <button onClick={() => setChatText('Tell me about solar government schemes in Tamil Nadu.')}>Schemes</button>

              <button onClick={() => setChatText('I would like a callback.')}>Request callback</button>

            </div>

            <form className="chat-lead" onSubmit={submitChatLead}>

              <details>

                <summary>Request a callback</summary>

                <label>Name<input required value={chatLead.name} onChange={(e) => setChatLead({ ...chatLead, name: e.target.value })} /></label>

                <label>Phone<input required pattern="[0-9+() -]{8,20}" value={chatLead.phone} onChange={(e) => setChatLead({ ...chatLead, phone: e.target.value })} /></label>

                <label>District<input value={chatLead.district} onChange={(e) => setChatLead({ ...chatLead, district: e.target.value })} /></label>

                <label className="consent">

                  <input type="checkbox" required checked={chatLead.consent} onChange={(e) => setChatLead({ ...chatLead, consent: e.target.checked })} />

                  I agree to be contacted.

                </label>

                <button className="button button-gold full" type="submit">Request callback</button>

              </details>

            </form>

          </div>

          <form className="chat-input" onSubmit={sendChat}>

            <input value={chatText} onChange={(e) => setChatText(e.target.value)} placeholder="Ask about solar…" aria-label="Chat message" />

            <button aria-label="Send message" type="submit">↑</button>

          </form>

        </aside>

      )}

      {adminOpen && (

        <div

          className="modal-backdrop"

          role="presentation"

          onMouseDown={(e) => {

            if (e.target === e.currentTarget) setAdminOpen(false);

          }}

        >

          <section className="admin-modal" role="dialog" aria-modal="true" aria-label="Admin portal">

            <div className="admin-title">

              <div>

                <div className="eyebrow">FIVE AND TWO ENERGY SOLUTIONS</div>

                <h2>Admin portal</h2>

              </div>

              <button className="close-button" onClick={() => setAdminOpen(false)} aria-label="Close admin portal">×</button>

            </div>

            {!adminToken ? (

              <form className="admin-login" onSubmit={adminLogin}>

                <p>

                  Sign in to manage customer enquiries, catalogue prices and

                  activity. The keyboard shortcut only opens this page; it does

                  not grant access.

                </p>

                <label>

                  Username

                  <input required autoComplete="username" value={credentials.username} onChange={(e) => setCredentials({ ...credentials, username: e.target.value })} />

                </label>

                <label>

                  Password

                  <input type="password" required autoComplete="current-password" value={credentials.password} onChange={(e) => setCredentials({ ...credentials, password: e.target.value })} />

                </label>

                <button className="button button-blue full" type="submit">Sign in securely</button>

                <small>Use the admin credentials configured in backend/.env. Change them before deployment.</small>

              </form>

            ) : (

              <div className="admin-dashboard">

                <div className="admin-toolbar">

                  <div className="admin-tabs">

                    <button className={adminTab === 'leads' ? 'active' : ''} onClick={() => setAdminTab('leads')}>Customer leads</button>

                    <button className={adminTab === 'panels' ? 'active' : ''} onClick={() => setAdminTab('panels')}>Panel prices</button>

                    <button className={adminTab === 'activity' ? 'active' : ''} onClick={() => setAdminTab('activity')}>Activity log</button>

                  </div>

                  <button className="text-link" onClick={logoutAdmin}>Log out</button>

                </div>

                {loadingAdmin && <p>Loading admin data…</p>}

                {adminTab === 'leads' && (

                  <div className="admin-table">

                    <h3>Customer enquiries <span>{leads.length}</span></h3>

                    {leads.length ? (

                      leads.map((l) => (

                        <article className="admin-lead" key={l.id}>

                          <div>

                            <b>{l.name}</b>

                            <small>{l.phone}{l.email ? ` · ${l.email}` : ''}</small>

                            <small>{l.district || 'District not provided'} · {l.source} · {new Date(l.created_at).toLocaleString()}</small>

                            {l.message && <p>{l.message}</p>}

                          </div>

                          <select value={l.status} onChange={(e) => updateLeadStatus(l.id, e.target.value)}>

                            <option>New</option>

                            <option>Contacted</option>

                            <option>Site Visit Scheduled</option>

                            <option>Quoted</option>

                            <option>Converted</option>

                            <option>Not Interested</option>

                          </select>

                        </article>

                      ))

                    ) : (

                      <p>No leads yet. Submit a test enquiry from the website.</p>

                    )}

                  </div>

                )}

                {adminTab === 'panels' && (

                  <div className="admin-table">

                    <h3>Panel catalogue prices</h3>

                    {adminPanels.map((p) => (

                      <div className="price-edit" key={p.id}>

                        <div><b>{p.brand} — {p.model}</b><small>{p.wattage} W</small></div>

                        <label>

                          ₹ / panel

                          <input

                            type="number"

                            min="1"

                            value={p.price}

                            onChange={(e) =>

                              setAdminPanels((prev) =>

                                prev.map((x) =>

                                  x.id === p.id ? { ...x, price: e.target.value } : x

                                )

                              )

                            }

                          />

                        </label>

                        <button className="button button-gold" onClick={() => updatePanel(p)}>Save price</button>

                      </div>

                    ))}

                    {!adminPanels.length && <p>No panel records are in the catalogue yet.</p>}

                  </div>

                )}

                {adminTab === 'activity' && (

                  <div className="admin-table">

                    <h3>Administrative activity</h3>

                    {activity.length ? (

                      activity.map((a) => (

                        <article className="activity-row" key={a.id}>

                          <b>{a.action}</b>

                          <span>{a.details}</span>

                          <small>{new Date(a.created_at).toLocaleString()}</small>

                        </article>

                      ))

                    ) : (

                      <p>No administrative actions recorded yet.</p>

                    )}

                  </div>

                )}

              </div>

            )}

          </section>

        </div>

      )}

    </>

  );

}

export default App;
