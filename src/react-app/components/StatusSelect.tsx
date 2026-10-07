import {
	SHIPMENT_STATUSES,
	type ShipmentStatus,
} from "../models/shipment";

function StatusSelect({
	status,
	disabled = false,
	onChange,
}: {
	status: ShipmentStatus;
	disabled?: boolean;
	onChange: (status: ShipmentStatus) => void;
}) {
	return (
		<select
			className={`status-select status-${status}`}
			value={status}
			disabled={disabled}
			onChange={(event) => onChange(event.target.value as ShipmentStatus)}
			aria-label="Shipment status"
		>
			{SHIPMENT_STATUSES.map((option) => (
				<option key={option.value} value={option.value}>
					{option.label}
				</option>
			))}
		</select>
	);
}

export default StatusSelect;
