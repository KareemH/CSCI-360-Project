var is_register_64 = function(value) {
  if (register_name_64.indexOf(value) >= 0) {
    return true;
  }
  return false;
};

var is_register_32 = function(value) {
  if (register_name_32.indexOf(value) >= 0) {
    return true;
  }
  return false;
};

var register32To64 = function(reg32) {
  index = register_name_32.indexOf(reg32);
  if (index >= 0) {
    return register_name_64[index];
  } else {
    return null;
  }
};

var convert32To64 = function(opRand) {
  if (is_register_32(opRand[0])) {
    opRand[0] = register32To64(opRand[0]);
  }
  if (is_register_32(opRand[1])) {
    opRand[1] = register32To64(opRand[1]);
  }
  return opRand
};

var is_memory_address = function(value) {
  if (value.indexOf('DWORD PTR') == 0) {
    return true;
  }
  return false;
};

var is_function = function(value) {
  for (var x = 0; x < function_table.length; x++) {
    if (function_table[x]["label"] == value.substring(0, value.length - 1)) {
      return true;
    }
  }
  return false;
};

var get_address = function(opRand) {
  var regExp = /\[([^]+)\]/;
  var matches = regExp.exec(opRand);
  address = matches[0].substring(1, matches[0].length - 1).replace(/\s/g, ''); // [rbp - 4]
  reg = address.substring(0, 3); // rbp
  value = parseInt(address.substring(3, address.length)); // -4
  return registers[reg] + value;
};

var get_stack_table_value_by_address = function(address) {
  for (var x = 0; x < stack_table.length; x++) {
    if (stack_table[x]["address"] == address) {
      return stack_table[x]["content"];
    }
  }
  return null;
};

var pop_stack_table = function() {
  while (true) {
    item = stack_table.pop();
    if (item["address"] == registers["rsp"]) {
      if (stack_table.length > 0) {
        registers["rsp"] = stack_table[stack_table.length - 1]["address"];
      } else {
        registers["rsp"] = stack_start_address;
      }
      return item["content"];
    }
  }
};

var update_stack_table_value = function(address, value, size) {
  var existFlag = false;
  for (var x = 0; x < stack_table.length; x++) {
    if (stack_table[x]["address"] == address) {
      stack_table[x]["content"] = value;
      existFlag = true;
      break;
    }
  }
  if (existFlag == false) {
    while (stack_table.length > 0 && address < stack_table[stack_table.length - 1]["address"] - size) {
      stack_table.push({
        "address": stack_table[stack_table.length - 1]["address"] - size,
        "content": 0,
        "label": ""
      });
    }
    stack_table.push({
      "address": address,
      "content": value,
      "label": ""
    });
  }
};

var update_stack_table_view = function() {
  $("#stack_table").html("");

  for (var x = 0; x < stack_table.length; x++) {
    stack_table[x]["label"] = "";
    if (stack_table[x]["address"] == registers["rbp"]) {
      stack_table[x]["label"] += "rbp";
    }
    if (stack_table[x]["address"] == registers["rsp"]) {
      stack_table[x]["label"] += " rsp";
    }
    $("#stack_table").append("<tr><td width='33%'>" + stack_table[x]["address"] + "</td><td width='33%'>" + stack_table[x]["content"] + "</td><td width='33%' style='vertical-align: middle;'><font style='background:#df9857;font-size:15pt;'>" + stack_table[x]["label"] + "</font></td></tr>")
  }

};

var push_handler = function(current_code) {
  opCode = "push";
  opRand = $.trim(current_code.substring(4, current_code.length))
  if (is_register_64(opRand) || is_register_32(opRand)) {
    if (is_register_32(opRand)) { // for 32 bits
      opRand = register32To64(opRand); // 32 bits register name to 64 bits register name
      registers["rsp"] -= 8
      update_stack_table_value(registers["rsp"], registers[opRand], 8);
    } else if (is_register_64(opRand)) { // for 64 bits
      registers["rsp"] -= 8
      update_stack_table_value(registers["rsp"], registers[opRand], 8);
    }
  } else if ($.isNumeric(opRand)) { // the source is an immediate value :
    registers["rsp"] -= 8 // for 64 bits
    update_stack_table_value(registers["rsp"], opRand, 8);
  }
};

var pop_handler = function(current_code) {
  opCode = "pop";
  opRand = $.trim(current_code.substring(4, current_code.length));
  if (is_register_64(opRand) || is_register_32(opRand)) {
    if (is_register_32(opRand)) {
      opRand = register32To64(opRand); // 32 bits register name to 64 bits register name
    }
    registers[opRand] = pop_stack_table();
  }
};

/*
	ret = pop rip
*/
var ret_handler = function(current_code) {
  opCode = "ret";
  return_address = pop_stack_table();
  registers["rip"] = return_address;
};

var mov_handler = function(current_code) {
  opCode = "mov";
  current_code = $.trim(current_code.substring(3, current_code.length));
  var opRand = current_code.split(",");
  for (var x = 0; x < opRand.length; x++) {
    opRand[x] = $.trim(opRand[x]);
  }
  opRand = convert32To64(opRand); // 32 bits register name to 64 bits register name
  if (is_register_64(opRand[0])) { // the destination is a register : mov eax, XXX
    if ($.isNumeric(opRand[1])) { // the source is an immediate value : mov eax, 100
      registers[opRand[0]] = parseInt(opRand[1]);
    } else if (is_memory_address(opRand[1])) { // the source is a memory address : mov eax, DWORD PTR [rbp-8]
      address = get_address(opRand[1]); // get address of DWORD PTR [rbp-8]
      registers[opRand[0]] = get_stack_table_value_by_address(address);
    } else { // if the source is a register : mov eax, edi
      registers[opRand[0]] = registers[opRand[1]];
    }
  } else if (is_memory_address(opRand[0])) { // the destination is a memory address : mov DWORD PTR [rbp-8], XXX
    address = get_address(opRand[0]); // get address of DWORD PTR [rbp-8]
    if ($.isNumeric(opRand[1])) { // the source is an immediate value : mov DWORD PTR [rbp-8], 100
      update_stack_table_value(address, parseInt(opRand[1]), 4);
    } else if (is_register_64(opRand[1]) || is_register_32(opRand[1])) { // the source is a register : mov DWORD PTR [rbp-8], edi
      update_stack_table_value(address, registers[opRand[1]], 4);
    }
  }
};

var sub_handler = function(current_code) {
  opCode = "sub";
  current_code = $.trim(current_code.substring(3, current_code.length));
  var opRand = current_code.split(",");
  for (var x = 0; x < opRand.length; x++) {
    opRand[x] = $.trim(opRand[x]);
  }
  opRand = convert32To64(opRand); // 32 bits register name to 64 bits register name
  if (is_register_64(opRand[0])) { // the destination is a register : sub rsp, XXX
    if ($.isNumeric(opRand[1])) { // the source is an immediate value : sub rsp, 100
      if (opRand[0] == "rsp") { // modify stack table
        for (var x = 0; x < parseInt(opRand[1]) / 4; x++) {
          update_stack_table_value(registers[opRand[0]] - 4, 0, 4);
          registers[opRand[0]] = registers[opRand[0]] - 4;
        }
      } else {
        registers[opRand[0]] = registers[opRand[0]] - parseInt(opRand[1]);
      }
    } else if (is_register_64(opRand[1])) { // sub eax, edx
      registers[opRand[0]] = registers[opRand[0]] - registers[opRand[1]];
    } else if (is_memory_address(opRand[1])) { // sub eax, DWORD PTR [rbp-8]
      address = get_address(opRand[1]); // get address of DWORD PTR [rbp-8]
      value = get_stack_table_value_by_address(address);
      registers[opRand[0]] = registers[opRand[0]] - value;
    }
  } else if (is_memory_address(opRand[0])) { // check if the destination is a memory address
    address = get_address(opRand[0]); // get address of DWORD PTR [rbp-8]
    old_value = get_stack_table_value_by_address(address);
    if ($.isNumeric(opRand[1])) { // the source is an immediate value : sub DWORD PTR [rbp-8], 100
      update_stack_table_value(address, old_value - opRand[1], 4);
    } else if (is_register_64(opRand[1])) { // the source is a register : sub DWORD PTR [rbp-8], eax
      update_stack_table_value(address, old_value - registers[opRand[1]], 4);
    }
  }
};

var add_handler = function(current_code) {
  opCode = "add";
  current_code = $.trim(current_code.substring(3, current_code.length));
  var opRand = current_code.split(",");
  for (var x = 0; x < opRand.length; x++) {
    opRand[x] = $.trim(opRand[x]);
  }
  opRand = convert32To64(opRand); // 32 bits register name to 64 bits register name
  if (is_register_64(opRand[0])) { // the destination is a register : add rsp, XXX
    if ($.isNumeric(opRand[1])) { // the source is an immediate value : add rsp, 100
      registers[opRand[0]] = registers[opRand[0]] + parseInt(opRand[1]);
    } else if (is_register_64(opRand[1])) { // add eax, edx
      registers[opRand[0]] = registers[opRand[0]] + registers[opRand[1]]
    } else if (is_memory_address(opRand[1])) { // add eax, DWORD PTR [rbp-8]
      address = get_address(opRand[1]); // get address of DWORD PTR [rbp-8]
      value = get_stack_table_value_by_address(address);
      registers[opRand[0]] = registers[opRand[0]] + value;
    }
  } else if (is_memory_address(opRand[0])) { // add DWORD PTR [rbp-8], xxx
    address = get_address(opRand[0]); // get address of DWORD PTR [rbp-8]
    old_value = get_stack_table_value_by_address(address);
    if ($.isNumeric(opRand[1])) { // the source is an immediate value : add DWORD PTR [rbp-8], 100
      update_stack_table_value(address, old_value + opRand[1], 4);
    } else if (is_register_64(opRand[1])) { // the source is a register : add DWORD PTR [rbp-8], eax
      update_stack_table_value(address, old_value + registers[opRand[1]], 4);
    }
  }
};

/*
	leave = mov rsp, rbp
	        pop rpb
*/
var leave_handler = function(current_code) {
  opCode = "leave";
  mov_handler("mov rsp, rbp");
  pop_handler("pop rbp");
};


var function_handler = function(current_code) { // call f1(int, int)
  opCode = "call";
  function_name = $.trim(current_code.substring(4, current_code.length));
  for (var x = 0; x < function_table.length; x++) {
    if (function_table[x]["label"] == function_name) {
      jump_address = function_table[x]["address"];
      return_address = registers["rip"] - 4;
      update_stack_table_value(registers["rsp"] - 8, return_address, 8)
      registers["rsp"] = registers["rsp"] - 8;
      registers["rip"] = jump_address;
    }
  }
  return true;
};
