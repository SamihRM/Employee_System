
import React, { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';
//import { supabaseAdmin } from '../../lib/supabaseAdmin';
import { Users, MapPin, Download, LogOut } from 'lucide-react';
import * as XLSX from 'xlsx';

// These are just example types. Adjust if your real types differ.
import type { Profile, Location, AttendanceRecord } from '../../types/database';

export default function AdminDashboard() {
  const { user, signOut } = useAuth();

  // State for employees, locations, attendance records
  const [employees, setEmployees] = useState<Profile[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [attendanceRecords, setAttendanceRecords] = useState<AttendanceRecord[]>([]);

  // Tab switching: "employees" | "locations" | "attendance"
  const [activeTab, setActiveTab] = useState<'employees' | 'locations' | 'attendance'>('employees');

  // ----------------------------------------
  // 1. EMPLOYEE FORM (Create/Update)
  // ----------------------------------------
  const [showEmployeeForm, setShowEmployeeForm] = useState(false);
  const [editingEmployeeId, setEditingEmployeeId] = useState<string | null>(null);

  // We'll keep a "password" here so we can create a user in auth.users
  // but we do NOT insert "email" or "password" into "profiles".
  const [employeeFormData, setEmployeeFormData] = useState<{
    first_name: string;
    last_name: string;
    email: string;     // For creating auth.users
    password: string;  // For creating auth.users
    role: 'employee' | 'admin';
    hourly_wage: number;
  }>({
    first_name: '',
    last_name: '',
    email: '',
    password: '',
    role: 'employee',
    hourly_wage: 0,
  });

  // ----------------------------------------
  // 2. LOCATION FORM (Create/Update)
  // ----------------------------------------
  const [showLocationForm, setShowLocationForm] = useState(false);
  const [editingLocationId, setEditingLocationId] = useState<string | null>(null);
  const [locationFormData, setLocationFormData] = useState<Partial<Location>>({
    name: '',
    address: '',
    link: '',
  });

  // ----------------------------------------
  // 3. Fetch Data on Mount
  // ----------------------------------------
  useEffect(() => {
    fetchEmployees();
    fetchLocations();
    fetchAttendanceRecords();
    calculateMonthlyHours();
    fetchActiveRecord();
    const interval = setInterval(() => {
      fetchAttendanceRecords();
    }, 60000);
    return () => clearInterval(interval);

  }, []);

  
  async function fetchEmployees() {
    // We select '*' from 'profiles' but note there's no 'email' column.
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching employees:', error);
      return;
    }
    setEmployees(data || []);
  }

  

  async function fetchLocations() {
    const { data, error } = await supabase
      .from('locations')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching locations:', error);
      return;
    }
    setLocations(data || []);
  }

  async function fetchAttendanceRecords() {
    // Notice we use "profiles:profile_id" to join, but
    // there's no "email" in 'profiles'.
    const { data, error } = await supabase
      .from('attendance_records')
      .select(`
        *,
        profiles:profile_id (first_name, last_name),
        locations:location_id (name)
      `)
      .order('check_in', { ascending: false });

    if (error) {
      console.error('Error fetching attendance records:', error);
      return;
    }
    setAttendanceRecords(data || []);
  }

  // ----------------------------------------
  // 4. EMPLOYEES (Open/Close Form, Submit)
  // ----------------------------------------
  function openEmployeeForm(employee?: Profile) {
    if (employee) {
      // Editing existing employee in "profiles"
      setEditingEmployeeId(employee.id);
      setEmployeeFormData({
        first_name: employee.first_name,
        last_name: employee.last_name,
        email: '',       // We don't store email in 'profiles', so leave blank
        password: '',    // For editing, we typically don't set a new password
        role: employee.role === 'admin' ? 'admin' : 'employee',
        hourly_wage: employee.hourly_wage ?? 0,
      });
    } else {
      // Creating a new employee
      setEditingEmployeeId(null);
      setEmployeeFormData({
        first_name: '',
        last_name: '',
        email: '',
        password: '',
        role: 'employee',
        hourly_wage: 0,
      });
    }
    setShowEmployeeForm(true);
  }

  function closeEmployeeForm() {
    setShowEmployeeForm(false);
  }

  async function handleEmployeeSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();

    try {
      if (editingEmployeeId) {
        // ----------------------------------
        // 4a. Update an existing employee
        // ----------------------------------
        const { error: updateError } = await supabase
          .from('profiles')
          .update({
            first_name: employeeFormData.first_name,
            last_name: employeeFormData.last_name,
            role: employeeFormData.role,
            hourly_wage: employeeFormData.hourly_wage,
            // Notice: no email or password, as these belong to auth.users
          })
          .eq('id', editingEmployeeId);

        if (updateError) throw updateError;
      } else {
        // ----------------------------------
        // 4b. Create a brand new employee
        // ----------------------------------
        // Step 1: Create user in auth.users using the Admin API
        const { data: userData, error: createUserError } = await supabaseAdmin.auth.admin.createUser({
          email: employeeFormData.email,
          password: employeeFormData.password || 'TempPass123',
          // optional: user_metadata
        });
        if (createUserError) throw createUserError;
        if (!userData?.user?.id) throw new Error('No user ID returned from createUser');

        // Step 2: Insert matching row in profiles
        const newUserId = userData.user.id;
        const { error: insertProfileError } = await supabase
          .from('profiles')
          .insert({
            id: newUserId,
            first_name: employeeFormData.first_name,
            last_name: employeeFormData.last_name,
            role: employeeFormData.role,
            hourly_wage: employeeFormData.hourly_wage,
          });
        if (insertProfileError) throw insertProfileError;
      }

      // Refresh the list & close form
      await fetchEmployees();
      closeEmployeeForm();
    } catch (error: any) {
      console.error('Error creating/updating employee:', error);
      alert(`Error: ${error.message}`);
    }
  }

  // ----------------------------------------
  // 5. LOCATIONS (Open/Close Form, Submit)
  // ----------------------------------------
  function openLocationForm(location?: Location) {
    if (location) {
      setEditingLocationId(location.id);
      setLocationFormData({
        name: location.name,
        address: location.address,
        link: location.link,
      });
    } else {
      setEditingLocationId(null);
      setLocationFormData({
        name: '',
        address: '',
        link: '',
      });
    }
    setShowLocationForm(true);
  }

  function closeLocationForm() {
    setShowLocationForm(false);
  }

  async function handleLocationSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();

    try {
      if (editingLocationId) {
        // Update
        const { error: updateError } = await supabase
          .from('locations')
          .update({
            name: locationFormData.name,
            address: locationFormData.address,
            link: locationFormData.link,
          })
          .eq('id', editingLocationId);

        if (updateError) throw updateError;
      } else {
        // Create new
        const { error: createError } = await supabase
          .from('locations')
          .insert({
            name: locationFormData.name,
            address: locationFormData.address,
            link: locationFormData.link,
          });

        if (createError) throw createError;
      }

      // Refresh & close form
      await fetchLocations();
      closeLocationForm();
    } catch (error: any) {
      console.error('Error creating/updating location:', error);
      alert(`Error: ${error.message}`);
    }
  }

  async function exportToExcel() {
    const wb = XLSX.utils.book_new(); // Create a new workbook
  
    // Group attendance records by employee
    const employeeMap: Record<string, AttendanceRecord[]> = {};
  
    for (const record of attendanceRecords) {
      const firstName = record.profiles?.first_name || 'Unknown';
      const lastName = record.profiles?.last_name || '';
      const employeeName = `${firstName} ${lastName}`.trim();
  
      if (!employeeMap[employeeName]) {
        employeeMap[employeeName] = [];
      }
      employeeMap[employeeName].push(record);
    }
  
    // Iterate through each employee and create a sheet for them
    for (const [employeeName, records] of Object.entries(employeeMap)) {
      const sheetData = [
        ['Week', 'Day', 'Date', 'Worked Hours', 'Ort.'], // Headers
      ];
  
      const currentDate = new Date(2025, 0, 1); // Start at January 1, 2025
      let weekNumber = 1; // Start with week 1
      let startRow = 2; // Track the starting row of the week (Excel rows are 1-based)
  
      while (currentDate.getFullYear() === 2025) {
        const weekStartRow = startRow; // Save the starting row of the week for formula reference
  
        for (let dayIndex = 0; dayIndex < 7; dayIndex++) {
          if (currentDate.getFullYear() !== 2025) break; // Stop if year changes
  
          // Match attendance record for the current date
          const matchedRecord = records.find((r) => {
            const checkInDate = new Date(r.check_in);
            return (
              checkInDate.getFullYear() === currentDate.getFullYear() &&
              checkInDate.getMonth() === currentDate.getMonth() &&
              checkInDate.getDate() === currentDate.getDate()
            );
          });
  
          let workedHours = 0;
          let location = '';
          if (matchedRecord) {
            const checkIn = new Date(matchedRecord.check_in);
            const checkOut = matchedRecord.check_out
              ? new Date(matchedRecord.check_out)
              : new Date(); // Assume "now" if no check-out
            workedHours =
              (checkOut.getTime() - checkIn.getTime()) / (1000 * 60 * 60); // Convert ms to hours
            workedHours = Number(workedHours.toFixed(2)); // Round to 2 decimals
            location = matchedRecord.locations?.name || '';
          }
  
          const dayName = currentDate.toLocaleDateString('en-US', { weekday: 'long' }); // Get day name
  
          sheetData.push([
            `Week ${weekNumber}`,
            dayName,
            currentDate.toLocaleDateString('de-DE'), // Format date as DD.MM.YYYY
            workedHours,
            location,
          ]);
  
          currentDate.setDate(currentDate.getDate() + 1); // Move to next day
          startRow++; // Increment row count
        }
  
        // Add a total row for the week
        const totalFormula = `=SUM(D${weekStartRow}:D${startRow - 1})`; // Sum column D for this week
        sheetData.push([`Week ${weekNumber} TOTAL`, '', '', totalFormula, '']);
        startRow++; // Increment row count for the total row
        weekNumber++; // Increment week number
      }
  
      // Create a worksheet for this employee
      const ws = XLSX.utils.aoa_to_sheet(sheetData);
  
      // Add the worksheet to the workbook
      XLSX.utils.book_append_sheet(wb, ws, employeeName.substring(0, 31)); // Sheet name limited to 31 characters
    }
  
    // Save the workbook
    XLSX.writeFile(wb, 'anwesenheit.xlsx');
  }
  // ----------------------------------------
  // 7. Render
  // ----------------------------------------
  return (
    <div className="min-h-screen bg-gray-100">
      {/* NAV BAR */}
      <nav className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex">
              <div className="flex-shrink-0 flex items-center">
                <h1 className="text-xl font-bold text-gray-800">Admin Dashboard</h1>
              </div>
              <div className="hidden sm:ml-6 sm:flex sm:space-x-8">
                <button
                  onClick={() => setActiveTab('employees')}
                  className={`${
                    activeTab === 'employees'
                      ? 'border-blue-500 text-gray-900'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  } inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium`}
                >
                  <Users className="w-4 h-4 mr-2" />
                  Mitarbeiter
                </button>
                <button
                  onClick={() => setActiveTab('locations')}
                  className={`${
                    activeTab === 'locations'
                      ? 'border-blue-500 text-gray-900'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  } inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium`}
                >
                  <MapPin className="w-4 h-4 mr-2" />
                  Standorte
                </button>
                <button
                  onClick={() => setActiveTab('attendance')}
                  className={`${
                    activeTab === 'attendance'
                      ? 'border-blue-500 text-gray-900'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  } inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium`}
                >
                  <Download className="w-4 h-4 mr-2" />
                  Anwesenheit
                </button>
              </div>
            </div>
            <div className="flex items-center">
              <span className="text-gray-700 mr-4">
                {user?.first_name} {user?.last_name}
              </span>
              <button
                onClick={() => signOut()}
                className="inline-flex items-center px-3 py-2 border border-transparent text-sm leading-4 font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
              >
                <LogOut className="w-4 h-4 mr-2" />
                Abmelden
              </button>
            </div>
          </div>
        </div>
      </nav>

      {/* MAIN CONTENT */}
      <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        {/* EMPLOYEES TAB */}
        {activeTab === 'employees' && (
          <div className="bg-white shadow rounded-lg">
            <div className="px-4 py-5 sm:p-6">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-lg font-medium text-gray-900">Mitarbeiterliste</h2>
                <button
                  onClick={() => openEmployeeForm()}
                  className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700"
                >
                  Neuen Mitarbeiter hinzufügen
                </button>
              </div>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Name
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Rolle
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Stundenlohn
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"></th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {employees.map((employee) => (
                      <tr key={employee.id}>
                        <td className="px-6 py-4 whitespace-nowrap">
                          {employee.first_name} {employee.last_name}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          {employee.role === 'admin' ? 'Administrator' : 'Mitarbeiter'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          {employee.hourly_wage}€/h
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <button
                            onClick={() => openEmployeeForm(employee)}
                            className="text-blue-600 hover:text-blue-500"
                          >
                            Bearbeiten
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* EMPLOYEE FORM MODAL */}
            {showEmployeeForm && (
              <div className="fixed inset-0 flex items-center justify-center z-50">
                <div
                  className="absolute inset-0 bg-black opacity-30"
                  onClick={closeEmployeeForm}
                ></div>
                <div className="bg-white p-6 rounded shadow relative z-10 w-full max-w-md">
                  <h3 className="text-lg font-medium mb-4">
                    {editingEmployeeId ? 'Mitarbeiter bearbeiten' : 'Neuen Mitarbeiter hinzufügen'}
                  </h3>
                  <form onSubmit={handleEmployeeSubmit}>
                    <div className="mb-4">
                      <label className="block text-sm font-medium text-gray-700">Vorname</label>
                      <input
                        type="text"
                        className="mt-1 block w-full border border-gray-300 rounded-md p-2"
                        value={employeeFormData.first_name}
                        onChange={(e) =>
                          setEmployeeFormData({
                            ...employeeFormData,
                            first_name: e.target.value,
                          })
                        }
                        required
                      />
                    </div>
                    <div className="mb-4">
                      <label className="block text-sm font-medium text-gray-700">Nachname</label>
                      <input
                        type="text"
                        className="mt-1 block w-full border border-gray-300 rounded-md p-2"
                        value={employeeFormData.last_name}
                        onChange={(e) =>
                          setEmployeeFormData({
                            ...employeeFormData,
                            last_name: e.target.value,
                          })
                        }
                        required
                      />
                    </div>
                    {/* Only show email & password fields when creating a NEW employee */}
                    {!editingEmployeeId && (
                      <>
                        <div className="mb-4">
                          <label className="block text-sm font-medium text-gray-700">E-Mail</label>
                          <input
                            type="email"
                            className="mt-1 block w-full border border-gray-300 rounded-md p-2"
                            value={employeeFormData.email}
                            onChange={(e) =>
                              setEmployeeFormData({
                                ...employeeFormData,
                                email: e.target.value,
                              })
                            }
                            required
                          />
                        </div>
                        <div className="mb-4">
                          <label className="block text-sm font-medium text-gray-700">Passwort</label>
                          <input
                            type="password"
                            className="mt-1 block w-full border border-gray-300 rounded-md p-2"
                            value={employeeFormData.password}
                            onChange={(e) =>
                              setEmployeeFormData({
                                ...employeeFormData,
                                password: e.target.value,
                              })
                            }
                            required
                          />
                        </div>
                      </>
                    )}
                    <div className="mb-4">
                      <label className="block text-sm font-medium text-gray-700">Rolle</label>
                      <select
                        className="mt-1 block w-full border border-gray-300 rounded-md p-2"
                        value={employeeFormData.role}
                        onChange={(e) =>
                          setEmployeeFormData({
                            ...employeeFormData,
                            role: e.target.value as 'admin' | 'employee',
                          })
                        }
                      >
                        <option value="employee">Mitarbeiter</option>
                        <option value="admin">Administrator</option>
                      </select>
                    </div>
                    <div className="mb-4">
                      <label className="block text-sm font-medium text-gray-700">Stundenlohn</label>
                      <input
                        type="number"
                        className="mt-1 block w-full border border-gray-300 rounded-md p-2"
                        value={employeeFormData.hourly_wage}
                        onChange={(e) =>
                          setEmployeeFormData({
                            ...employeeFormData,
                            hourly_wage: Number(e.target.value),
                          })
                        }
                      />
                    </div>
                    <div className="flex justify-end">
                      <button
                        type="button"
                        onClick={closeEmployeeForm}
                        className="mr-2 bg-gray-200 hover:bg-gray-300 text-gray-700 px-4 py-2 rounded"
                      >
                        Abbrechen
                      </button>
                      <button
                        type="submit"
                        className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded"
                      >
                        Speichern
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            )}
          </div>
        )}

        {/* LOCATIONS TAB */}
        {activeTab === 'locations' && (
          <div className="bg-white shadow rounded-lg">
            <div className="px-4 py-5 sm:p-6">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-lg font-medium text-gray-900">Standorte</h2>
                <button
                  onClick={() => openLocationForm()}
                  className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700"
                >
                  Neuen Standort hinzufügen
                </button>
              </div>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Name
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Adresse
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Link
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"></th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {locations.map((location) => (
                      <tr key={location.id}>
                        <td className="px-6 py-4 whitespace-nowrap">{location.name}</td>
                        <td className="px-6 py-4 whitespace-nowrap">{location.address}</td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          {location.link ? (
                            <a
                              href={location.link}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-blue-600 hover:text-blue-500"
                            >
                              Öffnen
                            </a>
                          ) : (
                            '-'
                          )}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <button
                            onClick={() => openLocationForm(location)}
                            className="text-blue-600 hover:text-blue-500"
                          >
                            Bearbeiten
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* LOCATION FORM MODAL */}
            {showLocationForm && (
              <div className="fixed inset-0 flex items-center justify-center z-50">
                <div
                  className="absolute inset-0 bg-black opacity-30"
                  onClick={closeLocationForm}
                ></div>
                <div className="bg-white p-6 rounded shadow relative z-10 w-full max-w-md">
                  <h3 className="text-lg font-medium mb-4">
                    {editingLocationId ? 'Standort bearbeiten' : 'Neuen Standort hinzufügen'}
                  </h3>
                  <form onSubmit={handleLocationSubmit}>
                    <div className="mb-4">
                      <label className="block text-sm font-medium text-gray-700">Name</label>
                      <input
                        type="text"
                        className="mt-1 block w-full border border-gray-300 rounded-md p-2"
                        value={locationFormData.name || ''}
                        onChange={(e) =>
                          setLocationFormData({ ...locationFormData, name: e.target.value })
                        }
                        required
                      />
                    </div>
                    <div className="mb-4">
                      <label className="block text-sm font-medium text-gray-700">Adresse</label>
                      <input
                        type="text"
                        className="mt-1 block w-full border border-gray-300 rounded-md p-2"
                        value={locationFormData.address || ''}
                        onChange={(e) =>
                          setLocationFormData({ ...locationFormData, address: e.target.value })
                        }
                      />
                    </div>
                    <div className="mb-4">
                      <label className="block text-sm font-medium text-gray-700">Link</label>
                      <input
                        type="text"
                        className="mt-1 block w-full border border-gray-300 rounded-md p-2"
                        value={locationFormData.link || ''}
                        onChange={(e) =>
                          setLocationFormData({ ...locationFormData, link: e.target.value })
                        }
                      />
                    </div>
                    <div className="flex justify-end">
                      <button
                        type="button"
                        onClick={closeLocationForm}
                        className="mr-2 bg-gray-200 hover:bg-gray-300 text-gray-700 px-4 py-2 rounded"
                      >
                        Abbrechen
                      </button>
                      <button
                        type="submit"
                        className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded"
                      >
                        Speichern
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ATTENDANCE TAB */}
        {activeTab === 'attendance' && (
          <div className="bg-white shadow rounded-lg">
            <div className="px-4 py-5 sm:p-6">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-lg font-medium text-gray-900">Anwesenheitsliste</h2>
                <button
                  onClick={exportToExcel}
                  className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700"
                >
                  <Download className="w-4 h-4 mr-2" />
                  Excel Export
                </button>
              </div>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Mitarbeiter
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Standort
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Check-In
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Check-Out
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Aufgabe
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {attendanceRecords.map((record) => (
                      <tr key={record.id}>
                        <td className="px-6 py-4 whitespace-nowrap">
                          {record.profiles
                            ? `${record.profiles.first_name} ${record.profiles.last_name}`
                            : 'Unknown'
                          }
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          {record.locations?.name || 'Unknown'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          {new Date(record.check_in).toLocaleString('de-DE')}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          {record.check_out
                            ? new Date(record.check_out).toLocaleString('de-DE')
                            : '-'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          {record.task || '-'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}