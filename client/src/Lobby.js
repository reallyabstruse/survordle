function valueToString(val) {
		if (Number.isInteger(val)) {
			return val || "∞";
		}
		
		return val ? "On" : "Off";
	}

function gameArrayToTDs(arr) {
	return arr.map((val, i) => <td key={i}>{valueToString(val)}</td>);
}

export function Lobby(props) { 
	return (
	<div className="lobby">
		<div className="lobby-title">
			Lobby
		</div>
		<table>
			<thead>
				<tr><th></th><th>Word remove</th><th>Guesses</th><th>Time</th><th>Hard mode</th></tr>
			</thead>
			<tbody>
				{props.wait && <tr className="own-game-lobby">
					<td>You</td>
					{gameArrayToTDs(props.wait)}
					</tr>}
				{props.games.map((arr, i) => 
					<tr className="lobby-game" key={i} onClick={() => props.joinGame(arr)}>
						<td></td>
						{gameArrayToTDs(arr)}
					</tr>
				)}
				{!props.games.length && !props.wait && <tr>
						<td className="empty-lobby" colSpan="5">No games in lobby</td>
					</tr>}
			</tbody>
		</table>
	</div>);
}