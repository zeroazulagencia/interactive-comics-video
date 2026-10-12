// Narra para Mac: arranca el servidor de Next.js incluido en la app y lo abre en
// una ventana. Los datos (base de datos, archivos generados y ajustes) se guardan
// en ~/Library/Application Support/com.zeroazul.narra/.

use std::fs::{self, File, OpenOptions};
use std::net::{TcpListener, TcpStream};
use std::path::Path;
use std::process::{Child, Command, Stdio};
use std::sync::Mutex;
use std::thread;
use std::time::{Duration, Instant};

use tauri::{Manager, RunEvent, Url, WebviewUrl, WebviewWindowBuilder};

struct Server(Mutex<Option<Child>>);

fn free_port() -> std::io::Result<u16> {
    Ok(TcpListener::bind("127.0.0.1:0")?.local_addr()?.port())
}

fn wait_until_listening(port: u16, timeout: Duration) -> bool {
    let start = Instant::now();
    while start.elapsed() < timeout {
        if TcpStream::connect(("127.0.0.1", port)).is_ok() {
            return true;
        }
        thread::sleep(Duration::from_millis(200));
    }
    false
}

// Proceso de Node con las rutas de la app de escritorio.
fn node(server_dir: &Path, data_dir: &Path, log: &File) -> std::io::Result<Command> {
    let mut cmd = Command::new(server_dir.join("node"));
    cmd.current_dir(server_dir)
        .env("NODE_ENV", "production")
        .env("DATABASE_URL", format!("file:{}", data_dir.join("narra.db").display()))
        .env("MEDIA_DIR", data_dir.join("media"))
        .env("ASSETS_DIR", server_dir.join("assets"))
        .env("FFMPEG_PATH", server_dir.join("ffmpeg"))
        .env("FFPROBE_PATH", server_dir.join("ffprobe"))
        .env("MIGRATIONS_DIR", server_dir.join("prisma").join("migrations"))
        .env("NARRA_DATA_DIR", data_dir)
        .env("NARRA_DESKTOP", "1")
        .stdout(Stdio::from(log.try_clone()?))
        .stderr(Stdio::from(log.try_clone()?));
    Ok(cmd)
}

fn start_server(server_dir: &Path, data_dir: &Path) -> Result<(Child, u16), String> {
    let err = |e: std::io::Error| e.to_string();
    fs::create_dir_all(data_dir.join("media")).map_err(err)?;
    let db = data_dir.join("narra.db");
    if !db.exists() {
        File::create(&db).map_err(err)?;
    }
    let log = OpenOptions::new()
        .create(true)
        .append(true)
        .open(data_dir.join("narra.log"))
        .map_err(err)?;

    let migrated = node(server_dir, data_dir, &log).map_err(err)?.arg("migrate.cjs").status().map_err(err)?;
    if !migrated.success() {
        return Err("No se pudo preparar la base de datos.".into());
    }

    let port = free_port().map_err(err)?;
    let child = node(server_dir, data_dir, &log)
        .map_err(err)?
        .arg("server.js")
        .env("PORT", port.to_string())
        .env("HOSTNAME", "127.0.0.1")
        .spawn()
        .map_err(err)?;
    Ok((child, port))
}

fn main() {
    tauri::Builder::default()
        .setup(|app| {
            app.manage(Server(Mutex::new(None)));
            let window = WebviewWindowBuilder::new(app, "main", WebviewUrl::App("index.html".into()))
                .title("Narra")
                .inner_size(1360.0, 880.0)
                .min_inner_size(960.0, 640.0)
                .build()?;
            let server_dir = app.path().resource_dir()?.join("server");
            let data_dir = app.path().app_data_dir()?;
            let handle = app.handle().clone();

            thread::spawn(move || {
                let result = start_server(&server_dir, &data_dir).and_then(|(child, port)| {
                    handle.state::<Server>().0.lock().unwrap().replace(child);
                    if wait_until_listening(port, Duration::from_secs(60)) {
                        Ok(port)
                    } else {
                        Err("El estudio no respondió a tiempo.".into())
                    }
                });
                match result {
                    Ok(port) => {
                        let url = Url::parse(&format!("http://127.0.0.1:{port}/")).expect("URL válida");
                        let _ = window.navigate(url);
                    }
                    Err(message) => {
                        let log = data_dir.join("narra.log").display().to_string();
                        let _ = window.eval(&format!("showError({message:?}, {log:?})"));
                    }
                }
            });
            Ok(())
        })
        .build(tauri::generate_context!())
        .expect("no se pudo iniciar Narra")
        .run(|app, event| {
            if let RunEvent::Exit = event {
                if let Some(mut child) = app.state::<Server>().0.lock().unwrap().take() {
                    let _ = child.kill();
                }
            }
        });
}
