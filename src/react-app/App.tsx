import HomeView from "./views/HomeView";
import ShipmentView from "./views/ShipmentView";
import "./App.css";

function App() {
	const shipmentMatch = window.location.pathname.match(/^\/shipment\/([0-9a-f-]+)$/i);

	return (
		<div className="app-shell">
			<header className="topbar">
				<a className="brand" href="/" aria-label="Parcelproof home">
					<span className="brand-mark" aria-hidden="true">
						<svg viewBox="0 0 24 24" fill="none">
							<path
								d="M3.5 7.5 12 3l8.5 4.5v9L12 21l-8.5-4.5v-9Z"
								stroke="currentColor"
								strokeWidth="1.7"
								strokeLinejoin="round"
							/>
							<path
								d="m3.8 7.7 8.2 4.4 8.2-4.4M12 12.2V21M8 5.1l8.4 4.6"
								stroke="currentColor"
								strokeWidth="1.7"
								strokeLinejoin="round"
							/>
						</svg>
					</span>
					<span>parcelproof</span>
				</a>
				<span className="topbar-note">Shipping, with receipts.</span>
			</header>
			{shipmentMatch ? (
				<ShipmentView shipmentId={shipmentMatch[1]} />
			) : (
				<HomeView />
			)}
		</div>
	);
}

export default App;
