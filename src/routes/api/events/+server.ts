const clients = new Set<ReadableStreamDefaultController<Uint8Array>>();
const encoder = new TextEncoder();

export function GET() {
	let controllerRef: ReadableStreamDefaultController<Uint8Array>;
	let heartbeat: ReturnType<typeof setInterval>;

	const stream = new ReadableStream<Uint8Array>({
		start(controller) {
			controllerRef = controller;
			clients.add(controller);
			controller.enqueue(encoder.encode(': connected\n\n'));
			heartbeat = setInterval(() => {
				try {
					controller.enqueue(encoder.encode(': heartbeat\n\n'));
				} catch {
					clearInterval(heartbeat);
					clients.delete(controller);
				}
			}, 15000);
		},
		cancel() {
			clearInterval(heartbeat);
			clients.delete(controllerRef);
		}
	});

	return new Response(stream, {
		headers: {
			'Content-Type': 'text/event-stream',
			'Cache-Control': 'no-cache, no-transform',
			'X-Accel-Buffering': 'no',
			Connection: 'keep-alive'
		}
	});
}

export function _notify() {
	for (const client of clients) {
		try {
			client.enqueue(encoder.encode('event: update\ndata: reload\n\n'));
		} catch {
			clients.delete(client);
		}
	}
}
