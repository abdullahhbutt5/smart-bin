from flask import Flask, jsonify
import pandas as pd
from sklearn.linear_model import LinearRegression
import os

app = Flask(__name__)

@app.route('/predict', methods=['GET'])
def predict():
    base_dir = os.path.dirname(os.path.abspath(__file__))
    metadata = pd.read_csv(os.path.join(base_dir, 'bin_metadata.csv'))
    fill_data = pd.read_csv(os.path.join(base_dir, 'bin_fill_data.csv'))

    predictions = []

    for bin_id in metadata['bin_id'].unique():
        bin_info = metadata[metadata['bin_id'] == bin_id].iloc[0]
        bin_data = fill_data[fill_data['bin_id'] == bin_id]

        # Check if bin is already full (any reading at 100%)
        is_already_full = any(bin_data['fill_level'] >= 99.9)
        
        if len(bin_data) < 2:
            status = 'full' if is_already_full else 'no-data'
            predictions.append({
                'bin_id': bin_id,
                'area': bin_info['area'],
                'latitude': bin_info['latitude'],
                'longitude': bin_info['longitude'],
                'predicted_fill': 100 if is_already_full else 0,
                'minutes_until_full': 'FULL' if is_already_full else 'N/A',
                'status': status,
                'insufficient_data': not is_already_full
            })
            continue

        bin_data = bin_data.copy()
        bin_data['timestamp'] = pd.to_datetime(bin_data['timestamp'], utc=True, errors='coerce')
        bin_data = bin_data.dropna(subset=['timestamp']).sort_values('timestamp')
        
        # If already full, skip prediction
        if is_already_full:
            predictions.append({
                'bin_id': bin_id,
                'area': bin_info['area'],
                'latitude': bin_info['latitude'],
                'longitude': bin_info['longitude'],
                'predicted_fill': 100,
                'minutes_until_full': 'FULL',
                'status': 'full',
                'insufficient_data': False
            })
            continue

        bin_data['time_index'] = (bin_data['timestamp'] - bin_data['timestamp'].min()).dt.total_seconds()
        X = bin_data['time_index'].values.reshape(-1, 1)
        y = bin_data['fill_level'].values

        model = LinearRegression()
        model.fit(X, y)

        slope = model.coef_[0]
        intercept = model.intercept_
        latest_time = bin_data['time_index'].max()
        latest_fill = y[-1]

        # Use the latest actual fill level if it's higher than prediction
        predicted_fill = max(
            round(model.predict([[latest_time + 3600]])[0], 1),
            latest_fill
        )

        if slope > 0:
            seconds_until_full = (100 - intercept) / slope
            minutes_until_full = max(0, int((seconds_until_full - latest_time) / 60))
        else:
            minutes_until_full = float('inf')

        # Determine status
        if is_already_full or predicted_fill >= 99.9:
            status = 'full'
            time_display = 'FULL'
            predicted_fill = 100
        elif predicted_fill >= 80:
            status = 'critical'
            time_display = f"in {minutes_until_full} min" if minutes_until_full != float('inf') else 'N/A'
        else:
            status = 'normal'
            time_display = f"in {minutes_until_full} min" if minutes_until_full != float('inf') else 'N/A'
        
        predictions.append({
            'bin_id': bin_id,
            'area': bin_info['area'],
            'latitude': bin_info['latitude'],
            'longitude': bin_info['longitude'],
            'predicted_fill': min(predicted_fill, 100.0),
            'minutes_until_full': time_display,
            'status': status,
            'insufficient_data': False
        })

    # Sort by status priority (full > critical > normal > no-data), then by predicted fill
    status_order = {'full': 0, 'critical': 1, 'normal': 2, 'no-data': 3}
    predictions.sort(key=lambda x: (
        status_order[x['status']], 
        -x['predicted_fill']
    ))
    
    return jsonify(predictions), 200

if __name__ == '__main__':
    app.run(debug=True, port=5001)
