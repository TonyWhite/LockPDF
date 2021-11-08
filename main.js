#!/usr/bin/env gjs

'use strict';

imports.gi.versions.Gtk = '3.0';
const { Gio, Gtk, Gdk, GLib } = imports.gi;

function getCurrentPath() {
  let stack = (new Error()).stack;
  let stackLine = stack.split('\n')[1];
  if (!stackLine) throw new Error('Could not find current file');
  let match = new RegExp('@(.+):\\d+').exec(stackLine);
  if (!match) throw new Error('Could not find current file');
  let path = match[1];
  let file = Gio.File.new_for_path(path);
  return file.get_parent().get_path();
}
const APPLICATION_DIR = getCurrentPath();

class AppWindow {
  constructor(app) {
    let builder = new Gtk.Builder();
    builder.add_from_file('main.glade');
    this._window = builder.get_object('window');
    this._window.set_application(app);
    this._window.connect('delete-event', this.quit);
    try { this._window.set_icon_from_file(APPLICATION_DIR + '/lockpdf.svg'); } // Setting app icon
    catch(err) { this._window.set_icon_name('application-x-executable'); }     // Fallback app icon
    
    // Title button
    this._revealer_button_back = builder.get_object('revealer_button_back');
    this._button_back = builder.get_object('button_back');
    this._button_back.connect('clicked', this.click_button_back.bind(this));
    
    // Stack
    this._stack_main = builder.get_object('stack_main');
    
    // page_drag_n_drop
    this._box_drag_n_drop = builder.get_object('box_drag_n_drop');
    this.target_entry = [ new Gtk.TargetEntry("STRING", Gtk.TargetFlags.OTHER_APP, 0) ];
    this._box_drag_n_drop.drag_dest_set(Gtk.DestDefaults.ALL, this.target_entry, Gdk.DragAction.COPY);
    this._box_drag_n_drop.connect('drag-data-received', this.drag_data_received.bind(this));
    this._button_open_file = builder.get_object('button_open_file');
    this._button_open_file.connect('clicked', this.click_button_open_file.bind(this));
    
    // page_about_pdf
    this._label_pdf_name = builder.get_object('label_pdf_name');
    this._label_pdf_encryption = builder.get_object('label_pdf_encryption');
    
    // stack_control_pdf
    this._stack_control_pdf = builder.get_object('stack_control_pdf');
    
    // page_lock
    this._entry_lock_open = builder.get_object('entry_lock_open');
    this._entry_lock_edit = builder.get_object('entry_lock_edit');
    this._switch_printable = builder.get_object('switch_printable');
    this._button_lock = builder.get_object('button_lock');
    this._button_lock.connect('clicked', this.click_button_lock.bind(this));
    // page_unlock_open
    this._entry_unlock_open = builder.get_object('entry_unlock_open');
    this._button_unlock_open = builder.get_object('button_unlock_open');
    this._button_unlock_open.connect('clicked', this.click_button_unlock_open.bind(this));
    // page_unlock_edit
    this._entry_unlock_edit = builder.get_object('entry_unlock_edit');
    this._button_unlock_edit = builder.get_object('button_unlock_edit');
    this._button_unlock_edit.connect('clicked', this.click_button_unlock_edit.bind(this));
    
    // Message from bottom of window
    this._revealer_message = builder.get_object('revealer_message');
    this._image_message = builder.get_object('image_message');
    this._label_message = builder.get_object('label_message');
    
    this.FILE_PDF = "";
  }
  
  drag_data_received(widget, context, x, y, data, info, time) {
    if ((data instanceof Gtk.SelectionData)&&(data.get_data_type()=="STRING")) {
      this.open_file(data.get_text());
    }
  }
  
  open_file(uri) {
    // Clean all password entries
    this._entry_lock_open.set_text("");
    this._entry_lock_edit.set_text("");
    this._entry_unlock_open.set_text("");
    this._entry_unlock_edit.set_text("");
    
    let text = clean_URI(uri);
    if (is_pdf(text)) {
      this.FILE_PDF = text;
      this._label_pdf_name.set_text(this.FILE_PDF.substring(this.FILE_PDF.lastIndexOf("/")+1));
      this._stack_main.set_visible_child_name('page_about_pdf');
      this._revealer_button_back.set_reveal_child(true);
      // Show controls to lock/unlock file.
      let requires_password = call_shell('qpdf --requires-password "' + this.FILE_PDF + '"');
      switch (requires_password[3]) {
        case 0:
          this._label_pdf_encryption.set_text("Requires password to open");
          this._stack_control_pdf.set_visible_child_name('page_unlock_open');
          this._button_unlock_open.grab_focus();
          break;
        case 2:
          this._label_pdf_encryption.set_text("Requires no password");
          this._stack_control_pdf.set_visible_child_name('page_lock');
          this._button_lock.grab_focus();
          break;
        case 3:
          this._label_pdf_encryption.set_text("Requires password to edit");
          this._stack_control_pdf.set_visible_child_name('page_unlock_edit');
          this._button_unlock_edit.grab_focus();
          break;
        default:
          let qpdf_version = call_shell("qpdf --version");
          qpdf_version = numsToString(qpdf_version[1]);
          qpdf_version = qpdf_version.substring(0, qpdf_version.indexOf("\n"));
          this._image_message.set_from_icon_name("dialog-error", 48);
          this._label_message.set_text("qpdf bug!\n" + qpdf_version + "\nFile analyzed:\n" + this.FILE_PDF + "\nqpdf --requires-password ${FILE}\nexited with status " + requires_password[3]);
          this._revealer_message.set_reveal_child(true);
      Gdk.threads_add_timeout(0, 10000, this._close_revealer_message.bind(this));
      }
    }
    else {
      this._image_message.set_from_icon_name("dialog-warning", 48);
      this._label_message.set_text("The file is not a PDF");
      this._revealer_message.set_reveal_child(true);
      Gdk.threads_add_timeout(0, 3000, this._close_revealer_message.bind(this));
    }
  }
  
  click_button_back() {
    this.FILE_PDF = "";
    this._stack_main.set_visible_child_name('page_drag_n_drop');
    this._revealer_button_back.set_reveal_child(false);
  }
  
  click_button_open_file() {
    let dialog = new Gtk.FileChooserDialog();
    dialog.connect('file-activated', dialog_activate);
    dialog.run();
    dialog.close();
    let filename = dialog.get_filename();
    if ((filename != null)&&(filename.length>0)) this.open_file(filename);
    
    function dialog_activate(a) {
      a.close();
    }
  }
  
  click_button_lock() {
    let password_to_open = this._entry_lock_open.get_text();
    let password_to_edit = this._entry_lock_edit.get_text();
    let printable = "none";
    if (this._switch_printable.get_state()) printable = "full";
    let result = call_shell('qpdf --encrypt "' + password_to_open + '" "' + password_to_edit + '" "128" --accessibility=y --extract=n --print=' + printable + ' --assemble=n --annotate=n --form=y --modify-other=n --modify=none --cleartext-metadata --use-aes=y -- "' + this.FILE_PDF + '" --replace-input');
    
    // Feedback of results
    if ((result[0] == true)&&(result[3] == 0)) {
      this._image_message.set_from_icon_name("dialog-information", 48);
      this._label_message.set_text("PDF locked.");
      this.click_button_back();
    }
    else {
      this._image_message.set_from_icon_name("dialog-error", 48);
      this._label_message.set_text("Can't lock PDF.");
    }
    this._revealer_message.set_reveal_child(true);
    Gdk.threads_add_timeout(0, 3000, this._close_revealer_message.bind(this));
  }
  
  _close_revealer_message() {
    this._revealer_message.set_reveal_child(false)
  }
  
  click_button_unlock_open() {
    let password = this._entry_unlock_open.get_text();
    let result = call_shell('qpdf --decrypt --password="' + password + '" -- "' + this.FILE_PDF + '" --replace-input');
    
    // Feedback of results
    if ((result[0] == true)&&(result[3] == 0)) {
      this._image_message.set_from_icon_name("dialog-information", 48);
      this._label_message.set_text("PDF unlocked.");
      this.click_button_back();
    }
    else {
      this._image_message.set_from_icon_name("dialog-error", 48);
      this._label_message.set_text("Can't unlock PDF.");
    }
    this._revealer_message.set_reveal_child(true);
    Gdk.threads_add_timeout(0, 3000, this._close_revealer_message.bind(this));
  }
  
  click_button_unlock_edit() {
    let password = this._entry_unlock_edit.get_text();
    let result = call_shell('qpdf --decrypt --password="' + password + '" -- "' + this.FILE_PDF + '" --replace-input');
    
    // Feedback of results
    if ((result[0] == true)&&(result[3] == 0)) {
      this._image_message.set_from_icon_name("dialog-information", 48);
      this._label_message.set_text("PDF unlocked.");
      this.click_button_back();
    }
    else {
      this._image_message.set_from_icon_name("dialog-error", 48);
      this._label_message.set_text("Can't unlock PDF.");
    }
    this._revealer_message.set_reveal_child(true);
    Gdk.threads_add_timeout(0, 3000, this._close_revealer_message.bind(this));
  }
  
  quit() {
    return false;
  }
}

/*
Give url
Return true if file is PDF
*/
function is_pdf(text) {
  let result = call_shell('file -b "' + text + '"');
  result[1] = numsToString(result[1]);
  
  if ((result[0])&&(result[1].length > 0)&&(result[1].indexOf("PDF") > -1)) return true;
  else if (text.substring(text.length-4).toLowerCase() == ".pdf") return true;
  else return false;
}

/*
If string ends with 10 or 13 char, delete it.
Return string without last char 10 or 13.
*/
function clean_URI(text) {
  // Remove encoded charachters
  try {
    text = decodeURI(text);
  }
  catch(error) {}
  
  // Remove "file://" from start
  if (text.indexOf("file://") == 0) text = text.substring(7);
  
  // Remove last return 10 & 13
  let lastChar = text.charCodeAt(text.length-1);
  while ((lastChar == 10)||(lastChar == 13)) {
    text = text.substring(0, text.length-1);
    lastChar = text.charCodeAt(text.length-1);
  }
  return text;
}

/*
* INFO
* Launch command in shell
* PARAMETERS
* command (String): command line
* async (Boolean): true if async. Default false.
* RETURNS
* Array that contains:
* [0] (Boolean): true on success, false if an error was set
* [1] (ByteArray): return stdout
* [2] (ByteArray): return stderr
* [3] (Number): return exit status
* THROWS EXCEPTION:
* None
*/
function call_shell(command, async) {
  let response = [];
  try {
    let parsed_command = GLib.shell_parse_argv(command);
    if (parsed_command[0]) {
      if (async==true) response = GLib.spawn_command_line_async(command);
      else response = GLib.spawn_command_line_sync(command);
    }
  } catch {}
  
  // Rebuild bad response
  if ((Array.isArray(response) == false)||(response.length == 0)) {
    response = [false,null,null,null];
  }
  else if (response.length != 4) {
    let tmp = [false,null,null,null];
    for(let i=0; i<response.length && i<tmp.length; i++) tmp[i] = response[i];
    response = tmp;
  }
  
  // Retrieve exit status
  let exit_status = null;
  try {
    exit_status = GLib.spawn_check_exit_status(response[3]);
    exit_status = 0;
  }
  catch(error) {
    exit_status = error.code;
  }
  response[3] = exit_status;
  return response;
}

/*
* From charcode array to String
*/
function numsToString(nums) {
  if (nums == null) return null;
  let result = "";
  for(let i=0; i<nums.length; i++) {
    result += String.fromCharCode(parseInt(nums[i]));
  }
  return result;
}

/*
* From String to charcode array
*/
function stringToNums(string) {
  if (string == null) return null;
  let result = [];
  for (let i=0; i<string.length; i++) {
    result.push(string.charCodeAt(i).toString());
  }
  return result;
}

function get_time() {
  let date = GLib.DateTime.new_now_utc();
  let h = date.get_hour();
  let m = date.get_minute();
  let s = date.get_second();
  let millis = date.get_microsecond();
  return h+":"+m+":"+s+":"+millis;
}

ARGV.unshift(imports.system.programInvocationName); //GTK Libraries (C++) expects ARGV[0] = Application name

GLib.set_prgname("LockPDF");
const application = new Gtk.Application({
    application_id: 'org.gtk.'+GLib.get_prgname(),
    flags: Gio.ApplicationFlags.FLAGS_NONE
});

application.connect('activate', (app) => {
    let mainWindow = app.activeWindow;
    if (!mainWindow) mainWindow = (new AppWindow(app))._window;
    mainWindow.present();
});

application.run(null);
