// Suppress the console window on Windows for GUI builds
fn main() {
    if std::env::var("CARGO_BIN_NAME").unwrap_or_default() == "nighthawk75-gui" {
        if cfg!(target_os = "windows") {
            println!("cargo:rustc-link-arg-bins=/SUBSYSTEM:WINDOWS");
            println!("cargo:rustc-link-arg-bins=/ENTRY:mainCRTStartup");
        }
    }
}
