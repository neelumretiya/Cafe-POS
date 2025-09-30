import React, { useState, useEffect, useMemo } from 'react';
import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously, signInWithCustomToken, onAuthStateChanged } from 'firebase/auth';
import { getFirestore, doc, setDoc, onSnapshot, collection, query, addDoc, serverTimestamp, orderBy, updateDoc, deleteDoc, getDocs } from 'firebase/firestore';
import { Utensils, BarChart3, X, Save, IndianRupee, Plus, Minus, ArrowLeft, Loader2, Table, Wallet } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, Legend } from 'recharts';

// --- CONFIGURATION AND SETUP ---

// Global variables provided by the environment
const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-pos-app-id';
const firebaseConfig = typeof __firebase_config !== 'undefined' ? JSON.parse(__firebase_config) : {};
const initialAuthToken = typeof __initial_auth_token !== 'undefined' ? __initial_auth_token : null;

// Menu Data - UPDATED WITH CAFE D'AROMA ITEMS
const MENU_ITEMS = [
  { category: 'Navaratri Special / Snacks', items: [
    { name: 'Panner Chilly', price: 200.00, id: 'ns1' },
    { name: 'Hara Bhara Kabab (08 Pcs)', price: 180.00, id: 'ns2' },
    { name: 'Manchurian (Dry/Gravy)', price: 100.00, id: 'ns3' },
    { name: 'Peri Peri Fries', price: 120.00, id: 'ns4' },
    { name: 'Fried Rice', price: 100.00, id: 'ns5' },
    { name: 'Veg Hakka Noodles', price: 100.00, id: 'ns6' },
    { name: 'French Fries', price: 80.00, id: 'ns7' },
    { name: 'Vegitable Maggie', price: 50.00, id: 'ns8' },
    { name: 'Live Dhokla', price: 50.00, id: 'ns9' },
  ]},
  { category: 'Beverages / Shakes', items: [
    { name: 'Oreo Shake', price: 100.00, id: 'b1' },
    { name: 'KitKat Shake', price: 100.00, id: 'b2' },
    { name: 'Cold Coffee', price: 100.00, id: 'b3' },
    { name: 'Badam Shake', price: 80.00, id: 'b4' },
    { name: 'Cold Coco', price: 70.00, id: 'b5' },
    { name: 'Hot Coffee', price: 30.00, id: 'b6' },
    { name: 'Tea', price: 20.00, id: 'b7' },
  ]},
];
// END OF UPDATED MENU DATA

// --- FIREBASE HOOKS AND UTILITIES ---

const useFirebase = () => {
  const [db, setDb] = useState(null);
  const [auth, setAuth] = useState(null);
  const [userId, setUserId] = useState(null);
  const [isAuthReady, setIsAuthReady] = useState(false);

  useEffect(() => {
    if (Object.keys(firebaseConfig).length === 0) {
      console.error("Firebase config is missing.");
      return;
    }

    try {
      const app = initializeApp(firebaseConfig);
      const firestore = getFirestore(app);
      const authInstance = getAuth(app);

      setDb(firestore);
      setAuth(authInstance);

      const unsubscribe = onAuthStateChanged(authInstance, async (user) => {
        if (!user) {
          try {
            if (initialAuthToken) {
              await signInWithCustomToken(authInstance, initialAuthToken);
            } else {
              await signInAnonymously(authInstance);
            }
          } catch (error) {
            console.error("Firebase Auth Error:", error);
          }
        }
        setUserId(authInstance.currentUser?.uid || crypto.randomUUID());
        setIsAuthReady(true);
      });

      return () => unsubscribe();
    } catch (e) {
      console.error("Firebase Initialization Error:", e);
    }
  }, []);

  return { db, auth, userId, isAuthReady, appId };
};

const getTablesCollectionRef = (db) => collection(db, 'artifacts', appId, 'public', 'data', 'tables');
const getSalesCollectionRef = (db) => collection(db, 'artifacts', appId, 'public', 'data', 'sales');

// --- COMPONENTS ---

// 1. Order Management Modal
const OrderModal = ({ table, onClose, onSave, onCheckout }) => {
  const [currentOrder, setCurrentOrder] = useState(table.order);
  const [message, setMessage] = useState('');

  const tableTotal = useMemo(() => {
    return currentOrder.reduce((sum, item) => sum + item.price * item.quantity, 0);
  }, [currentOrder]);

  const updateItemQuantity = (item, delta) => {
    setCurrentOrder(prevOrder => {
      const existingItem = prevOrder.find(i => i.id === item.id);

      if (existingItem) {
        const newQuantity = existingItem.quantity + delta;
        if (newQuantity <= 0) {
          return prevOrder.filter(i => i.id !== item.id);
        }
        return prevOrder.map(i =>
          i.id === item.id ? { ...i, quantity: newQuantity } : i
        );
      } else if (delta > 0) {
        return [...prevOrder, { ...item, quantity: 1 }];
      }
      return prevOrder;
    });
  };

  const handleSave = () => {
    onSave(table.tableId, currentOrder, tableTotal);
    setMessage('Order saved!');
    setTimeout(() => setMessage(''), 1500);
  };

  const handleCheckout = () => {
    if (currentOrder.length === 0) {
      setMessage('Cannot checkout an empty order.');
      setTimeout(() => setMessage(''), 1500);
      return;
    }
    onCheckout(table.tableId, currentOrder, tableTotal);
    setMessage('Checkout complete!');
    setTimeout(onClose, 500);
  };

  const baseButtonClasses = "px-4 py-2 rounded-xl text-sm font-semibold transition duration-200 shadow-lg flex items-center justify-center";

  return (
    <div className="fixed inset-0 bg-black bg-opacity-75 z-50 flex justify-center items-center p-4" onClick={onClose}>
      <div 
        className="bg-white rounded-3xl w-full max-w-4xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden" 
        onClick={e => e.stopPropagation()}
      >
        <div className="p-6 bg-indigo-600 text-white flex justify-between items-center">
          <h2 className="text-3xl font-extrabold flex items-center">
            <Table className="mr-3 h-7 w-7" /> Table {table.tableId} Order
          </h2>
          <button onClick={onClose} className="p-2 rounded-full hover:bg-indigo-700 transition">
            <X />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto grid md:grid-cols-2 lg:grid-cols-3 gap-6 p-6">
          
          {/* Menu Section */}
          <div className="md:col-span-2 space-y-6">
            <h3 className="text-2xl font-bold text-gray-800 border-b-2 pb-2">Menu</h3>
            {MENU_ITEMS.map((section, index) => (
              <div key={index} className="rounded-xl p-4 bg-gray-50 shadow-inner">
                <h4 className="text-xl font-semibold mb-3 text-indigo-700">{section.category}</h4>
                <div className="grid grid-cols-2 gap-3">
                  {section.items.map(item => (
                    <div key={item.id} className="flex justify-between items-center bg-white p-3 rounded-lg shadow-sm border border-gray-200">
                      <div>
                        <p className="font-medium text-gray-900">{item.name}</p>
                        <p className="text-sm text-gray-500">₹{item.price.toFixed(2)}</p>
                      </div>
                      <button 
                        onClick={() => updateItemQuantity(item, 1)}
                        className="bg-green-500 hover:bg-green-600 text-white p-2 rounded-full transition-transform transform hover:scale-105"
                      >
                        <Plus className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>

          {/* Current Order Section */}
          <div className="bg-white rounded-xl shadow-2xl border border-gray-100 flex flex-col p-4 space-y-4">
            <h3 className="text-2xl font-bold text-gray-800 border-b-2 pb-2">Current Order</h3>
            <div className="flex-1 overflow-y-auto space-y-3">
              {currentOrder.length === 0 ? (
                <p className="text-gray-500 italic text-center py-4">Add items from the menu.</p>
              ) : (
                currentOrder.map(item => (
                  <div key={item.id} className="flex justify-between items-center p-3 bg-indigo-50 rounded-lg">
                    <div className="flex-1">
                      <p className="font-semibold text-gray-900">{item.name}</p>
                      <p className="text-sm text-indigo-600">₹{(item.price * item.quantity).toFixed(2)}</p>
                    </div>
                    <div className="flex items-center space-x-2">
                      <button 
                        onClick={() => updateItemQuantity(item, -1)}
                        className="p-1 bg-red-400 hover:bg-red-500 text-white rounded-full transition"
                      >
                        <Minus className="w-4 h-4" />
                      </button>
                      <span className="font-bold w-6 text-center">{item.quantity}</span>
                      <button 
                        onClick={() => updateItemQuantity(item, 1)}
                        className="p-1 bg-green-400 hover:bg-green-500 text-white rounded-full transition"
                      >
                        <Plus className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
            
            <div className="mt-4 pt-4 border-t border-gray-200">
              <div className="flex justify-between items-center text-2xl font-bold mb-4 text-indigo-800">
                <span>Total:</span>
                <span>₹{tableTotal.toFixed(2)}</span>
              </div>
              
              <p className="text-sm text-center text-green-600 h-5 mb-2 transition-opacity">
                {message}
              </p>

              <button 
                onClick={handleSave} 
                className={`${baseButtonClasses} w-full mb-3 bg-indigo-500 hover:bg-indigo-600 text-white`}
              >
                <Save className="mr-2 w-5 h-5" /> Save Order
              </button>
              
              <button 
                onClick={handleCheckout} 
                className={`${baseButtonClasses} w-full bg-green-600 hover:bg-green-700 text-white`}
              >
                <Wallet className="mr-2 w-5 h-5" /> Checkout & Close
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};


// 2. Main Orders View
const OrdersView = ({ tables, handleTableClick, isAuthReady, db }) => {
  const tableNumbers = Array.from({ length: 10 }, (_, i) => i + 1);
  const baseCardClasses = "p-6 rounded-2xl shadow-xl transform transition duration-300 hover:scale-[1.02] cursor-pointer";
  
  // Function to initialize tables if they don't exist
  useEffect(() => {
    if (isAuthReady && db && tables.length === 0) {
      console.log('Initializing tables...');
      const initTables = async () => {
        try {
          for (let i = 1; i <= 10; i++) {
            const tableRef = doc(getTablesCollectionRef(db), String(i));
            // Check if table exists before setting initial state
            // (Using setDoc with merge:true is simpler to ensure existence without overwriting)
            await setDoc(tableRef, {
              tableId: i,
              status: 'Closed',
              order: [],
              total: 0,
            }, { merge: true });
          }
          console.log('Tables initialized.');
        } catch (error) {
          console.error('Error initializing tables:', error);
        }
      };
      initTables();
    }
  }, [isAuthReady, db, tables.length]);


  if (!isAuthReady) {
    return <div className="p-8 text-center text-lg text-gray-500">Loading authentication...</div>;
  }

  return (
    <div className="p-8">
      <h1 className="text-4xl font-bold text-gray-800 mb-8 flex items-center">
        <Utensils className="mr-3 w-8 h-8 text-indigo-600" /> Table Orders Dashboard
      </h1>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6">
        {tableNumbers.map(num => {
          const tableData = tables.find(t => t.tableId === num) || { tableId: num, status: 'Closed', total: 0 };
          const isOpen = tableData.status === 'Open';
          
          return (
            <div
              key={num}
              onClick={() => handleTableClick(tableData)}
              className={`${baseCardClasses} ${
                isOpen 
                  ? 'bg-red-50 ring-4 ring-red-400 border-t-8 border-red-500' 
                  : 'bg-white border border-gray-200'
              }`}
            >
              <div className="flex justify-between items-start">
                <h2 className={`text-4xl font-extrabold ${isOpen ? 'text-red-600' : 'text-gray-800'}`}>
                  Table {num}
                </h2>
                <div className={`px-3 py-1 text-xs font-semibold rounded-full ${
                  isOpen ? 'bg-red-500 text-white' : 'bg-green-100 text-green-700'
                }`}>
                  {isOpen ? 'OPEN' : 'CLOSED'}
                </div>
              </div>
              <p className="mt-4 text-sm font-medium text-gray-500">Current Total</p>
              <p className={`text-3xl font-bold ${isOpen ? 'text-red-700' : 'text-gray-900'}`}>
                ₹{tableData.total ? tableData.total.toFixed(2) : '0.00'}
              </p>
              {isOpen && (
                <p className="mt-2 text-xs text-red-500">Click to Edit/Checkout</p>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};


// 3. Sales Reports View
const ReportsView = ({ salesData }) => {
  const [reportType, setReportType] = useState('Daily'); // Daily, Monthly, Yearly

  const aggregatedData = useMemo(() => {
    // Aggregates sales data based on the report type (Day, Month, Year)
    const data = {};
    const today = new Date().toISOString().split('T')[0];

    salesData.forEach(sale => {
      const saleDate = sale.timestamp ? new Date(sale.timestamp.seconds * 1000) : new Date(today);
      let key, label;
      
      if (reportType === 'Daily') {
        key = saleDate.toISOString().split('T')[0];
        label = key;
      } else if (reportType === 'Monthly') {
        key = saleDate.toISOString().substring(0, 7); // YYYY-MM
        label = new Intl.DateTimeFormat('en-US', { year: 'numeric', month: 'short' }).format(saleDate);
      } else { // Yearly
        key = saleDate.getFullYear().toString();
        label = key;
      }

      if (!data[key]) {
        data[key] = { name: label, sales: 0 };
      }
      data[key].sales += sale.total;
    });

    const sortedData = Object.values(data).sort((a, b) => a.name.localeCompare(b.name));
    return sortedData;
  }, [salesData, reportType]);

  const totalSales = aggregatedData.reduce((sum, item) => sum + item.sales, 0);

  const buttonClasses = (type) => 
    `px-4 py-2 rounded-full font-semibold transition ${
      reportType === type 
        ? 'bg-indigo-600 text-white shadow-md' 
        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
    }`;

  return (
    <div className="p-8">
      <h1 className="text-4xl font-bold text-gray-800 mb-8 flex items-center">
        <BarChart3 className="mr-3 w-8 h-8 text-indigo-600" /> Sales Reports ({reportType})
      </h1>

      <div className="flex justify-between items-center mb-6 p-4 bg-white rounded-xl shadow-lg">
        <div className="flex space-x-3">
          <button onClick={() => setReportType('Daily')} className={buttonClasses('Daily')}>Daily</button>
          <button onClick={() => setReportType('Monthly')} className={buttonClasses('Monthly')}>Monthly</button>
          <button onClick={() => setReportType('Yearly')} className={buttonClasses('Yearly')}>Yearly</button>
        </div>
        <div className="text-xl font-bold text-indigo-700">
            Total Sales Recorded: ₹{totalSales.toFixed(2)}
        </div>
      </div>
      
      <div className="bg-white p-6 rounded-2xl shadow-xl h-[500px]">
        {salesData.length === 0 ? (
          <div className="text-center py-20 text-gray-500 text-lg">No sales data recorded yet.</div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={aggregatedData}
              margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="name" stroke="#333" />
              <YAxis domain={[0, 'auto']} tickFormatter={(value) => `₹${value.toFixed(0)}`} stroke="#333" />
              <Tooltip formatter={(value) => [`₹${value.toFixed(2)}`, 'Sales']} />
              <Legend />
              <Bar dataKey="sales" fill="#4f46e5" name="Sales Revenue" radius={[10, 10, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
};

// 4. Main App Component
const App = () => {
  const { db, auth, userId, isAuthReady, appId } = useFirebase();
  const [view, setView] = useState('orders'); // 'orders' or 'reports'
  const [tables, setTables] = useState([]);
  const [salesData, setSalesData] = useState([]);
  const [selectedTable, setSelectedTable] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [loading, setLoading] = useState(true);

  // --- Real-time Data Listeners ---
  useEffect(() => {
    if (!isAuthReady || !db) return;

    // 1. Listen to Tables
    const tablesQuery = query(getTablesCollectionRef(db));
    const unsubscribeTables = onSnapshot(tablesQuery, (snapshot) => {
      const newTables = snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id }));
      setTables(newTables.sort((a, b) => a.tableId - b.tableId));
      setLoading(false);
    }, (error) => {
      console.error("Error fetching tables:", error);
    });

    // 2. Listen to Sales (no orderBy due to potential index issues, will sort in memory)
    const salesQuery = query(getSalesCollectionRef(db));
    const unsubscribeSales = onSnapshot(salesQuery, (snapshot) => {
      const newSales = snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id }));
      setSalesData(newSales);
    }, (error) => {
      console.error("Error fetching sales:", error);
    });

    return () => {
      unsubscribeTables();
      unsubscribeSales();
    };
  }, [isAuthReady, db]);

  // --- Order Handling Logic ---

  const handleTableClick = (table) => {
    setSelectedTable(table);
    setIsModalOpen(true);
  };

  const saveOrder = async (tableId, orderItems, total) => {
    if (!db) return;
    try {
      const tableRef = doc(getTablesCollectionRef(db), String(tableId));
      await updateDoc(tableRef, {
        order: orderItems,
        total: total,
        status: orderItems.length > 0 ? 'Open' : 'Closed',
        lastUpdate: serverTimestamp()
      });
    } catch (error) {
      console.error("Error saving order:", error);
    }
  };

  const handleCheckout = async (tableId, orderItems, total) => {
    if (!db) return;
    try {
      // 1. Record the sale
      await addDoc(getSalesCollectionRef(db), {
        tableId: tableId,
        items: orderItems,
        total: total,
        timestamp: serverTimestamp(),
        // Store a simple date string for easier filtering/sorting in aggregation
        date: new Date().toISOString().split('T')[0]
      });

      // 2. Clear the table
      const tableRef = doc(getTablesCollectionRef(db), String(tableId));
      await updateDoc(tableRef, {
        order: [],
        total: 0,
        status: 'Closed'
      });
      
    } catch (error) {
      console.error("Error during checkout:", error);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <Loader2 className="animate-spin h-10 w-10 text-indigo-600" />
        <p className="ml-3 text-xl font-medium text-gray-700">Loading POS data...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 font-inter">
      {/* Header and Navigation */}
      <header className="sticky top-0 bg-white shadow-md z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex justify-between items-center">
          <h1 className="text-2xl font-extrabold text-indigo-700">Restaurant POS</h1>
          <div className="flex space-x-4">
            <button
              onClick={() => setView('orders')}
              className={`flex items-center px-4 py-2 rounded-xl font-medium transition ${
                view === 'orders' ? 'bg-indigo-600 text-white shadow-lg' : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              <Utensils className="mr-2 w-5 h-5" /> Orders
            </button>
            <button
              onClick={() => setView('reports')}
              className={`flex items-center px-4 py-2 rounded-xl font-medium transition ${
                view === 'reports' ? 'bg-indigo-600 text-white shadow-lg' : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              <BarChart3 className="mr-2 w-5 h-5" /> Reports
            </button>
          </div>
        </div>
      </header>
      
      {/* Main Content Area */}
      <main className="max-w-7xl mx-auto">
        {view === 'orders' && (
          <OrdersView 
            tables={tables} 
            handleTableClick={handleTableClick} 
            isAuthReady={isAuthReady}
            db={db}
          />
        )}
        {view === 'reports' && (
          <ReportsView salesData={salesData} />
        )}
      </main>

      {/* Order Modal */}
      {isModalOpen && selectedTable && (
        <OrderModal 
          table={selectedTable} 
          onClose={() => setIsModalOpen(false)}
          onSave={saveOrder}
          onCheckout={handleCheckout}
        />
      )}
    </div>
  );
};

export default App;
