let SCREEN_WIDTH = 0;
let SCREEN_HEIGHT = 0;

// Drawing functions to handled inverted Y-Axis of the browser
const drawRect = (x, y, w, h) => rect(x, y, w, h);
const drawLine = (x1, y1, x2, y2) => line(x1, y1, x2, y2);
const drawCircle = (x, y, d) => circle(x, y, d);
const drawArc = (x, y, w, h, startAngle, stopAngle) => arc(x, y, w, h, 2*Math.PI-stopAngle, 2*Math.PI-startAngle);
const drawTri = (x1, y1, x2, y2, x3, y3) => triangle(x1, y1, x2, y2, x3, y3);

const NO_CHAR = '.'; // The char that will represent an empty cell in the solution grid
let temperature = 0.0;
let current_worker = null;
let current_solution_to_draw = []; // Array of strings. Each string is a row in the solution.
let current_worker_stats = { letters: '', best_score: 1_000_000, start_time: 0n, end_time: 0n, is_running: false }

function StartSolve() {
	frameRate(60);

	console.log('Starting solve:');
	console.log(document.getElementById('letters').value);

	// Terminate the current worker if it's still running
	if (current_worker) { current_worker.terminate(); }

	// Start a new worker for this job
	current_worker = new Worker("js/wasm_runner.js", {type:"module"});

	// Handle messages from the worker
	current_worker.onmessage = (evt) => {
		if (evt.data == 'isready') {
			// TODO: Get entered letters
			let letters = document.getElementById('letters').value;
			let cleaned_letters = letters.trim().toLowerCase().split('').filter(char => char.charCodeAt(0) >= 97 && char.charCodeAt(0) <= 122).join('');
			if (cleaned_letters.length <= 0) {
				current_worker.terminate();
				return;
			}

			let solve_temperature = Math.min(Math.max(temperature, 0.0), 1.0); // Clamp Temperature between 0.0 - 1.0
			solve_temperature = solve_temperature*0.5; // Reduce the Temperature to a max of 0.5, since 1 temperature of 1.0 will skip everything.

			// current_worker.postMessage(["abcdefghijklmnopqrstuvwxyzabcdefghijklmnopqrstuvwxyz", 0.0]);
			// current_worker.postMessage(["alexanderthomaswellslauraalmagropuente", 0.1]);
			current_worker.postMessage([cleaned_letters, solve_temperature]);
			current_worker_stats.is_running = true;
			current_worker_stats.start_time = BigInt(performance.now());
		}
		else if (evt.data.startsWith('newbest')) {
			UpdateBestSolution(evt.data);
		}
		else if (evt.data == 'done') {
			current_worker_stats.is_running = false;
			current_worker_stats.end_time = BigInt(performance.now());
			current_worker.terminate();
			frameRate(5);
		}
	}
}

function HandleTemperatureChange() {
	temperature = parseFloat(document.getElementById('temperature').value);
	UpdateTempValueInUi();
}

function UpdateTempValueInUi() {
	document.getElementById('temperature_value').innerText = (Math.round(temperature * 1000)/1000).toString();
}

function UpdateBestSolution(msg_from_worker) {
	let pieces = msg_from_worker.split(',');
	// console.log("[+] New Best", pieces[1]);

	// Update the best score found
	current_worker_stats.best_score = parseInt(pieces[1]);

	// Check if we have a final solution
	if (current_worker_stats.best_score === 0) {
		current_worker_stats.end_time = BigInt(performance.now());
		current_worker_stats.is_running = false;
	}

	// Update the current best solution
	current_solution_to_draw = pieces[2].toUpperCase().split('\n');
}

// Initial Setup
function setup() {
	SCREEN_WIDTH = window.innerWidth - 40;
	SCREEN_HEIGHT = window.innerHeight - 100;

	temperature = parseFloat(document.getElementById('temperature').value);
	UpdateTempValueInUi();

	createCanvas(window.innerWidth-40, window.innerHeight-100);
}

function windowResized() {
	SCREEN_WIDTH = window.innerWidth - 40;
	SCREEN_HEIGHT = window.innerHeight - 100;
	resizeCanvas(window.innerWidth-40, window.innerHeight-100);
}

function PrettyPrintTimeTaken() {
	if (current_worker_stats.start_time == 0n) return 'N/A';

	let time_diff_in_ms;

	if (current_worker_stats.is_running) {
		time_diff_in_ms = BigInt(performance.now()) - current_worker_stats.start_time;
	} else {
		time_diff_in_ms = current_worker_stats.end_time - current_worker_stats.start_time;
	}

	// return `(${current_worker_stats.start_time}) (${current_worker_stats.end_time}) (now ${BigInt(performance.now())})`;

	let seconds = (time_diff_in_ms / 1000n).toString();
	let milliseconds = (time_diff_in_ms % 1000n).toString();

	return `${seconds}.${milliseconds.padStart(3,'0')}`;
}

// To be called each frame
function draw() {
	// TODO: Calculate this properly based on screen size and amount of letters
	let cell_size = 50;
	let offset_x = 30;
	let offset_y = 60;

	// Will the solution fit on the screen?
	let required_width = offset_x + cell_size * ((current_solution_to_draw[0] || []).length+1);
	let required_height = offset_y + cell_size * (current_solution_to_draw.length+1);

	if (required_width > SCREEN_WIDTH || required_height > SCREEN_HEIGHT) {
		SCREEN_WIDTH = required_width;
		SCREEN_HEIGHT = required_height;
		resizeCanvas(required_width,required_height);
	}

	// Draw background & set Rectangle draw mode
	background(255);
	rectMode(CENTER);

	// Draw scene rectangle
	fill(30);
	noStroke();
	drawRect(SCREEN_WIDTH / 2, SCREEN_HEIGHT / 2, SCREEN_WIDTH, SCREEN_HEIGHT);

	// Draw Stats
	let solve_stats_text;
	if (current_worker_stats.start_time === 0n) {
		solve_stats_text = "Enter letters and click 'Solve' to begin";
	} else if (current_worker_stats.is_running) {
		solve_stats_text = `${current_worker_stats.best_score} character(s) remaining. Time taken: ${PrettyPrintTimeTaken()}s`;
	} else if (!current_worker_stats.is_running && current_worker_stats.best_score == 0) {
		solve_stats_text = `Solved in ${PrettyPrintTimeTaken()}s.`;
	} else if (!current_worker_stats.is_running && current_worker_stats.best_score != 0) {
		solve_stats_text = `Failed to solve, ${current_worker_stats.best_score} character(s) remaining. Time taken: ${PrettyPrintTimeTaken()}s.`;
	}

	textSize(18);
	textAlign(LEFT, CENTER);
	fill(230);
	noStroke();
	text(solve_stats_text, 30, 30);

	textSize(32);
	textAlign(CENTER, CENTER);

	for (let y = 0; y < current_solution_to_draw.length; ++y) {
		for (let x = 0; x < current_solution_to_draw[y].length; ++x) {
			let char_to_draw = current_solution_to_draw[y][x];

			if (char_to_draw == NO_CHAR) {
				fill(30,30,30);
				stroke(255,255,255);
				drawRect(offset_x + x*cell_size + cell_size/2, offset_y + y*cell_size + cell_size/2, cell_size, cell_size);
			} else {
				fill(30,200,30);
				stroke(255,255,255);
				drawRect(offset_x + x*cell_size + cell_size/2, offset_y + y*cell_size + cell_size/2, cell_size, cell_size);

				fill(0,0,0);
				stroke(0,0,0);
				text(char_to_draw, offset_x + x*cell_size + cell_size/2, offset_y + y*cell_size + cell_size/2);
			}
		}
	}
}
