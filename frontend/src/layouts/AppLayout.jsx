import Sidebar from "../components/sidebar/Sidebar";

function AppLayout({ children }) {
    return (
        <div className="h-screen bg-[#020617] text-white flex overflow-hidden">

            {/* Sidebar */}
            <Sidebar />

            {/* Main Content */}
            <main className="flex-1 overflow-hidden">
                {children}
            </main>

        </div>
    );
}

export default AppLayout;