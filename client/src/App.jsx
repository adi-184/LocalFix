import { useState, useEffect, useRef } from 'react';

const API_BASE = 'https://localfix-zfxa.onrender.com/api';
const USER_LAT = 29.9476;
const USER_LNG = 76.8155;

export default function App() {
  const [view, setView] = useState('customer'); // 'customer' or 'retailer'
  const [toolTab, setToolTab] = useState('ai'); // 'ai' or 'caliper'

  // Search States
  const [item, setItem] = useState('Tap');
  const [size, setSize] = useState('1/2');
  const [radius, setRadius] = useState(5000);
  const [results, setResults] = useState([]);
  const [loadingSearch, setLoadingSearch] = useState(false);
  const [unlockedStores, setUnlockedStores] = useState({});
  const [compareList, setCompareList] = useState([]);

  // AI Analyzer States
  const [imageFile, setImageFile] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const [context, setContext] = useState('');
  const [aiResult, setAiResult] = useState(null);
  const [loadingAI, setLoadingAI] = useState(false);

  // Digital Caliper State (in mm)
  const [caliperMm, setCaliperMm] = useState(10);

  // Map Refs
  const mapRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const circleRef = useRef(null);
  const markersLayerRef = useRef(null);

  // Retailer Dashboard States
  const [dashboardData, setDashboardData] = useState({ stores: [], recent_leads: [] });
  const [newProduct, setNewProduct] = useState({
    store_id: 1,
    product_name: '',
    category: 'Plumbing',
    size_spec: '',
    price: ''
  });

  // Fetch Nearby Products
  const handleSearch = async (searchItem = item, searchSize = size, searchRadius = radius) => {
    setLoadingSearch(true);
    try {
      const res = await fetch(
        `${API_BASE}/search?item=${encodeURIComponent(searchItem)}&size=${encodeURIComponent(searchSize)}&radius=${searchRadius}`
      );
      const data = await res.json();
      if (data.success) setResults(data.results);
    } catch (err) {
      console.error('Search error:', err);
    }
    setLoadingSearch(false);
  };

  useEffect(() => {
    handleSearch();
  }, [radius]);

  // Initialize & Update Interactive Leaflet Map
  useEffect(() => {
    if (view !== 'customer' || !window.L || !mapRef.current) return;

    if (!mapInstanceRef.current) {
      const L = window.L;
      const map = L.map(mapRef.current).setView([USER_LAT, USER_LNG], 13);

      L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; OpenStreetMap'
      }).addTo(map);

      // User Location Marker
      L.circleMarker([USER_LAT, USER_LNG], {
        radius: 8,
        fillColor: '#3b82f6',
        color: '#ffffff',
        weight: 2,
        fillOpacity: 1
      })
        .addTo(map)
        .bindPopup('<b>📍 Your Location</b><br/>Searching nearby hardware stores');

      // Radius Circle
      circleRef.current = L.circle([USER_LAT, USER_LNG], {
        radius: radius,
        color: '#3b82f6',
        fillColor: '#3b82f6',
        fillOpacity: 0.12,
        weight: 1.5
      }).addTo(map);

      markersLayerRef.current = L.layerGroup().addTo(map);
      mapInstanceRef.current = map;
    } else {
      // Update Radius Circle dynamically
      if (circleRef.current) {
        circleRef.current.setRadius(radius);
      }
    }

    // Plot Store Pins
    if (markersLayerRef.current && window.L) {
      const L = window.L;
      markersLayerRef.current.clearLayers();
      results.forEach((r) => {
        if (r.store_lat && r.store_lng) {
          L.marker([r.store_lat, r.store_lng])
            .addTo(markersLayerRef.current)
            .bindPopup(
              `<b>🏪 ${r.store_name}</b><br/>${r.product_name} (${r.size_spec})<br/><b style="color:#10b981">₹${r.price}</b> • ${r.distance_meters}m away`
            );
        }
      });
    }
  }, [results, radius, view]);

  // Handle AI Image Upload & Analysis
  const handleImageChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setImageFile(file);
      setImagePreview(URL.createObjectURL(file));
    }
  };

  const handleAnalyzePart = async (e) => {
    e.preventDefault();
    if (!imageFile) return alert('Pehle tute hue part ya pipe ki photo select karein!');
    setLoadingAI(true);
    setAiResult(null);

    const formData = new FormData();
    formData.append('image', imageFile);
    formData.append('context', context || 'Standard Indian household fitting');

    try {
      const res = await fetch(`${API_BASE}/analyze-part`, {
        method: 'POST',
        body: formData
      });
      const data = await res.json();
      if (data.success) {
        setAiResult(data.ai_analysis);
      } else {
        alert('AI Error: ' + data.error);
      }
    } catch (err) {
      alert('Failed to connect to AI server');
    }
    setLoadingAI(false);
  };

  // Smart Keyword Extraction for Database Search
  const applyAiToSearch = () => {
    if (!aiResult) return;
    const rawPart = (aiResult.identified_part + ' ' + aiResult.full_specification).toLowerCase();
    let partKeyword = aiResult.identified_part.split(' ')[0];
    if (rawPart.includes('tap') || rawPart.includes('cock')) partKeyword = 'Tap';
    else if (rawPart.includes('elbow')) partKeyword = 'Elbow';
    else if (rawPart.includes('bolt') || rawPart.includes('nut')) partKeyword = 'Bolt';
    else if (rawPart.includes('pipe')) partKeyword = 'Pipe';

    const sizeKeyword = aiResult.recommended_size.split(' ')[0];
    setItem(partKeyword);
    setSize(sizeKeyword);
    handleSearch(partKeyword, sizeKeyword, radius);
  };

  // Record Qualified Lead for Retailer
  const handleUnlockStore = async (product) => {
    setUnlockedStores((prev) => ({ ...prev, [product.product_id]: true }));
    try {
      await fetch(`${API_BASE}/leads`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          store_id: product.store_id,
          searched_item: `${product.product_name} (${product.size_spec})`
        })
      });
    } catch (err) {
      console.error('Lead error:', err);
    }
  };

  const toggleCompare = (product) => {
    setCompareList((prev) =>
      prev.find((p) => p.product_id === product.product_id)
        ? prev.filter((p) => p.product_id !== product.product_id)
        : [...prev, product]
    );
  };

  const fetchDashboard = async () => {
    try {
      const res = await fetch(`${API_BASE}/retailer/dashboard`);
      const data = await res.json();
      if (data.success) setDashboardData(data);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    if (view === 'retailer') {
      mapInstanceRef.current = null;
      fetchDashboard();
    }
  }, [view]);

  const handleAddProduct = async (e) => {
    e.preventDefault();
    try {
      const res = await fetch(`${API_BASE}/products`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newProduct)
      });
      const data = await res.json();
      if (data.success) {
        alert('✅ Product added to local inventory!');
        setNewProduct({ ...newProduct, product_name: '', size_spec: '', price: '' });
      }
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans">
      {/* Navbar */}
      <header className="border-b border-slate-800 bg-slate-900/80 backdrop-blur sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-4 py-4 flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-extrabold tracking-tight text-blue-400">
              🔧 LocalFix
            </h1>
            <p className="text-xs text-slate-400">
              AI-Powered Hyper-Local Hardware Discovery (1km - 5km)
            </p>
          </div>
          <div className="flex gap-2 bg-slate-800 p-1 rounded-lg">
            <button
              onClick={() => setView('customer')}
              className={`px-4 py-1.5 rounded-md text-sm font-medium transition ${
                view === 'customer' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white'
              }`}
            >
              🔍 Customer App
            </button>
            <button
              onClick={() => setView('retailer')}
              className={`px-4 py-1.5 rounded-md text-sm font-medium transition ${
                view === 'retailer' ? 'bg-emerald-600 text-white' : 'text-slate-400 hover:text-white'
              }`}
            >
              🏪 Retailer Portal
            </button>
          </div>
        </div>
      </header>

      {view === 'customer' ? (
        <main className="max-w-6xl mx-auto px-4 py-8 grid grid-cols-1 lg:grid-cols-12 gap-8">
          {/* LEFT COLUMN: Hardware Size Finder (AI Vision + 1:1 Digital Scale) */}
          <div className="lg:col-span-5 space-y-6">
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl">
              {/* Mode Switcher Tabs */}
              <div className="grid grid-cols-2 gap-2 bg-slate-950 p-1 rounded-xl border border-slate-800 mb-5">
                <button
                  onClick={() => setToolTab('ai')}
                  className={`py-2 rounded-lg text-xs font-bold transition ${
                    toolTab === 'ai' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  📸 AI Photo Analyzer
                </button>
                <button
                  onClick={() => setToolTab('caliper')}
                  className={`py-2 rounded-lg text-xs font-bold transition ${
                    toolTab === 'caliper' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  📏 1:1 Digital Scale
                </button>
              </div>

              {toolTab === 'ai' ? (
                <>
                  <div className="flex items-center justify-between mb-3">
                    <span className="bg-blue-500/10 text-blue-400 border border-blue-500/20 text-xs font-semibold px-2.5 py-1 rounded-full">
                      ✨ Gemini Vision AI
                    </span>
                    <span className="text-xs text-slate-400">Reference Scaling Ready</span>
                  </div>
                  <h2 className="text-xl font-bold mb-1">Confused About Hardware Size?</h2>
                  <p className="text-sm text-slate-400 mb-4">
                    Tute hue tap, pipe ya nut-bolt ki photo upload karein (exact mm/inch ke liye paas mein ₹10 ka coin rakhein).
                  </p>

                  <form onSubmit={handleAnalyzePart} className="space-y-4">
                    <label className="block border-2 border-dashed border-slate-700 hover:border-blue-500 rounded-xl p-4 text-center cursor-pointer transition">
                      {imagePreview ? (
                        <img
                          src={imagePreview}
                          alt="Preview"
                          className="max-h-48 mx-auto rounded-lg object-contain"
                        />
                      ) : (
                        <div className="py-6 text-slate-400">
                          <p className="text-3xl mb-2">📸</p>
                          <p className="text-sm font-medium text-slate-200">Click to Upload Hardware Photo</p>
                          <p className="text-xs text-slate-500 mt-1">Supports JPG, PNG, WEBP</p>
                        </div>
                      )}
                      <input type="file" accept="image/*" onChange={handleImageChange} className="hidden" />
                    </label>

                    <div>
                      <label className="block text-xs text-slate-400 mb-1">
                        Where is this used? (Optional Context)
                      </label>
                      <input
                        type="text"
                        placeholder="e.g., Bathroom wall tap, ₹10 coin kept next to pipe"
                        value={context}
                        onChange={(e) => setContext(e.target.value)}
                        className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500"
                      />
                    </div>

                    <button
                      type="submit"
                      disabled={loadingAI}
                      className="w-full bg-blue-600 hover:bg-blue-500 disabled:bg-slate-700 text-white font-semibold py-2.5 rounded-lg transition"
                    >
                      {loadingAI ? '🤖 AI Analyzing Part & Size...' : '🔍 Detect Exact Size with AI'}
                    </button>
                  </form>

                  {/* AI Result Box */}
                  {aiResult && (
                    <div className="mt-6 bg-slate-950 border border-emerald-500/30 rounded-xl p-4 space-y-2">
                      <div className="flex justify-between items-start">
                        <div>
                          <p className="text-xs text-emerald-400 font-semibold uppercase">AI Recommendation</p>
                          <h3 className="text-lg font-bold text-white">{aiResult.full_specification}</h3>
                        </div>
                        <span className="bg-emerald-500/20 text-emerald-300 text-xs font-bold px-2.5 py-1 rounded">
                          {aiResult.recommended_size}
                        </span>
                      </div>
                      <p className="text-sm text-slate-300">{aiResult.advice_hinglish}</p>
                      {aiResult.extra_items?.length > 0 && (
                        <p className="text-xs text-amber-400">
                          💡 <strong>Don't forget:</strong> {aiResult.extra_items.join(', ')}
                        </p>
                      )}
                      <button
                        onClick={applyAiToSearch}
                        className="w-full mt-2 bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-semibold py-2 rounded-lg transition"
                      >
                        📍 Find "{aiResult.identified_part} ({aiResult.recommended_size})" Nearby
                      </button>
                    </div>
                  )}
                </>
              ) : (
                /* 1:1 ON-SCREEN DIGITAL CALIPER */
                <div className="space-y-4">
                  <h2 className="text-xl font-bold">📏 On-Screen Nut/Bolt Caliper</h2>
                  <p className="text-xs text-slate-400">
                    Apne purane nut, bolt ya washer ko screen ke circle par rakhein aur slider se size match karein:
                  </p>

                  <div className="bg-slate-950 border border-slate-800 rounded-xl p-6 flex flex-col items-center justify-center min-h-[190px]">
                    <div
                      style={{
                        width: `${caliperMm * 3.78}px`,
                        height: `${caliperMm * 3.78}px`
                      }}
                      className="rounded-full border-2 border-blue-400 bg-blue-500/20 flex items-center justify-center transition-all"
                    >
                      <span className="text-[11px] font-bold text-blue-300">{caliperMm}mm</span>
                    </div>
                  </div>

                  <div>
                    <div className="flex justify-between text-xs mb-1">
                      <span className="text-slate-400">Adjust Diameter:</span>
                      <span className="font-bold text-emerald-400">
                        {caliperMm} mm (M{caliperMm} Standard)
                      </span>
                    </div>
                    <input
                      type="range"
                      min="4"
                      max="32"
                      step="1"
                      value={caliperMm}
                      onChange={(e) => setCaliperMm(Number(e.target.value))}
                      className="w-full accent-blue-500 cursor-pointer"
                    />
                  </div>

                  <button
                    onClick={() => {
                      setItem('Bolt');
                      setSize(`${caliperMm}mm`);
                      handleSearch('Bolt', `${caliperMm}mm`, radius);
                    }}
                    className="w-full bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-semibold py-2.5 rounded-lg transition"
                  >
                    🔍 Search "{caliperMm}mm (M{caliperMm}) Nut-Bolt" Nearby
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* RIGHT COLUMN: Hyper-Local Radius Search, Interactive Map & Store Results */}
          <div className="lg:col-span-7 space-y-6">
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-4">
              <h2 className="text-xl font-bold">📍 Hyper-Local Store Inventory Search</h2>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs text-slate-400 mb-1">Hardware Item</label>
                  <input
                    type="text"
                    value={item}
                    onChange={(e) => setItem(e.target.value)}
                    placeholder="e.g., Tap, Elbow, Bolt"
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs text-slate-400 mb-1">Size / Spec</label>
                  <input
                    type="text"
                    value={size}
                    onChange={(e) => setSize(e.target.value)}
                    placeholder="e.g., 1/2, 3/4, 10mm"
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm"
                  />
                </div>
                <div className="flex items-end">
                  <button
                    onClick={() => handleSearch(item, size, radius)}
                    className="w-full bg-blue-600 hover:bg-blue-500 text-white font-semibold py-2 rounded-lg text-sm transition"
                  >
                    Search Nearby
                  </button>
                </div>
              </div>

              {/* Radius Slider */}
              <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 flex items-center justify-between gap-4">
                <span className="text-xs text-slate-400 whitespace-nowrap">
                  Search Radius: <strong className="text-blue-400">{(radius / 1000).toFixed(1)} km</strong>
                </span>
                <input
                  type="range"
                  min="500"
                  max="5000"
                  step="500"
                  value={radius}
                  onChange={(e) => setRadius(Number(e.target.value))}
                  className="w-full accent-blue-500 cursor-pointer"
                />
              </div>

              {/* LIVE INTERACTIVE POSTGIS MAP */}
              <div className="rounded-xl overflow-hidden border border-slate-800">
                <div ref={mapRef} className="w-full h-56 bg-slate-950 z-0" />
              </div>
            </div>

            {/* Comparison Tray */}
            {compareList.length > 0 && (
              <div className="bg-blue-950/40 border border-blue-500/40 rounded-2xl p-4">
                <div className="flex justify-between items-center mb-3">
                  <h3 className="text-sm font-bold text-blue-300">
                    ⚖️ Instant Store Comparison ({compareList.length} selected)
                  </h3>
                  <button onClick={() => setCompareList([])} className="text-xs text-slate-400 hover:text-white">
                    Clear
                  </button>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {compareList.map((c) => (
                    <div key={c.product_id} className="bg-slate-900 p-3 rounded-lg border border-slate-800 text-xs">
                      <p className="font-bold text-white">{c.product_name}</p>
                      <p className="text-slate-400">{c.store_name}</p>
                      <p className="text-emerald-400 font-bold text-sm mt-1">₹{c.price}</p>
                      <p className="text-blue-400">{c.distance_meters}m away</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Results List */}
            <div className="space-y-4">
              {loadingSearch ? (
                <p className="text-slate-400 text-sm">Scanning local stores via PostGIS...</p>
              ) : results.length === 0 ? (
                <div className="bg-slate-900 border border-slate-800 rounded-xl p-8 text-center text-slate-400">
                  No matching stock found within {(radius / 1000).toFixed(1)} km. Try increasing the radius slider!
                </div>
              ) : (
                results.map((r) => (
                  <div
                    key={r.product_id}
                    className="bg-slate-900 border border-slate-800 hover:border-slate-700 rounded-2xl p-5 flex flex-col sm:flex-row justify-between gap-4 transition"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="bg-emerald-500/10 text-emerald-400 text-xs font-semibold px-2 py-0.5 rounded">
                          In Stock
                        </span>
                        <span className="bg-blue-500/10 text-blue-400 text-xs font-semibold px-2 py-0.5 rounded">
                          📍 {r.distance_meters} meters away
                        </span>
                      </div>
                      <h3 className="text-lg font-bold text-white">{r.product_name}</h3>
                      <p className="text-xs text-slate-400">
                        Required Spec: <strong className="text-slate-200">{r.size_spec}</strong> • Category: {r.category}
                      </p>
                      <p className="text-sm font-medium text-slate-300 pt-1">🏪 {r.store_name}</p>

                      {unlockedStores[r.product_id] && (
                        <div className="mt-2 p-2.5 bg-slate-950 border border-emerald-500/30 rounded-lg text-xs space-y-1">
                          <p className="text-slate-200">
                            <strong>Address:</strong> {r.address}
                          </p>
                          <p className="text-emerald-400 font-semibold">
                            📞 Phone: {r.phone} (Walk-in for Physical Quality Check)
                          </p>
                        </div>
                      )}
                    </div>

                    <div className="flex sm:flex-col justify-between items-end gap-2">
                      <div className="text-right">
                        <p className="text-2xl font-extrabold text-white">₹{r.price}</p>
                        <p className="text-[11px] text-slate-400">Pick up today</p>
                      </div>

                      <div className="flex gap-2">
                        <button
                          onClick={() => toggleCompare(r)}
                          className="px-3 py-1.5 rounded-lg border border-slate-700 hover:bg-slate-800 text-xs font-medium"
                        >
                          {compareList.some((c) => c.product_id === r.product_id) ? '✓ Comparing' : '+ Compare'}
                        </button>
                        <button
                          onClick={() => handleUnlockStore(r)}
                          className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold"
                        >
                          {unlockedStores[r.product_id] ? '✓ Store Unlocked' : 'Visit Store'}
                        </button>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </main>
      ) : (
        /* RETAILER SAAS DASHBOARD */
        <main className="max-w-6xl mx-auto px-4 py-8 grid grid-cols-1 md:grid-cols-2 gap-8">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
            <h2 className="text-xl font-bold mb-1">📦 Add Store Inventory</h2>
            <p className="text-xs text-slate-400 mb-4">
              List hardware items with exact size specifications for local customers.
            </p>
            <form onSubmit={handleAddProduct} className="space-y-4">
              <div>
                <label className="block text-xs text-slate-400 mb-1">Select Store</label>
                <select
                  value={newProduct.store_id}
                  onChange={(e) => setNewProduct({ ...newProduct, store_id: Number(e.target.value) })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm"
                >
                  {dashboardData.stores.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.store_name} ({s.address})
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs text-slate-400 mb-1">Product Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g., Heavy Brass Gate Valve"
                  value={newProduct.product_name}
                  onChange={(e) => setNewProduct({ ...newProduct, product_name: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-slate-400 mb-1">Exact Size Spec</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g., 1/2 inch (15mm)"
                    value={newProduct.size_spec}
                    onChange={(e) => setNewProduct({ ...newProduct, size_spec: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs text-slate-400 mb-1">Price (₹)</label>
                  <input
                    type="number"
                    required
                    placeholder="250"
                    value={newProduct.price}
                    onChange={(e) => setNewProduct({ ...newProduct, price: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm"
                  />
                </div>
              </div>
              <button
                type="submit"
                className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-semibold py-2.5 rounded-lg text-sm"
              >
                + Publish to Local Radius
              </button>
            </form>
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
            <h2 className="text-xl font-bold mb-1">📈 Qualified Customer Leads</h2>
            <p className="text-xs text-slate-400 mb-4">
              Real-time local buyers who unlocked your store location to inspect items in person.
            </p>
            <div className="space-y-3">
              {dashboardData.recent_leads.length === 0 ? (
                <p className="text-sm text-slate-500">
                  No leads yet. Click "Visit Store" in Customer mode to see live lead tracking!
                </p>
              ) : (
                dashboardData.recent_leads.map((l) => (
                  <div
                    key={l.id}
                    className="bg-slate-950 border border-slate-800 p-3 rounded-xl flex justify-between items-center text-xs"
                  >
                    <div>
                      <p className="font-bold text-emerald-400">🔥 High-Intent Walk-in Lead</p>
                      <p className="text-slate-200 mt-0.5">Looking for: {l.searched_item}</p>
                      <p className="text-slate-400">Store: {l.store_name}</p>
                    </div>
                    <span className="text-slate-500">
                      {new Date(l.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>
        </main>
      )}
    </div>
  );
}