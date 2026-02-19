######################################################################################################
#       _Name_  collection/event/H3A/common/H3A_LibOracle.pm
#       _ServiceName_   NOT APPLICABLE
#       _Description_   Common subroutines used by multiple CAPE Nodes
#       _Zone_  NOT APPLICABLE
#       _SelectStatement_       NOT APPLICABLE
#       _PollTime_      0
######################################################################################################
#
# Common functions used by Assure1 CAPE and Services.
#
# Source Control:
#       1.0		2023-12-14	aignerma	<STORY>		initial version
#
######################################################################################################

######################################################################################################
# INCLUDES
######################################################################################################
require DBD::Oracle;
import DBD::Oracle qw(:ora_types);
use DBI;

######################################################################################################
# Name: GetByFilter 
# Parameters: a db handle
#             a table or view name
#             a filter condition
#             a result hash ref (where the result should be written to)
#             a column filter (array ref)
#             a undef or "CountOnly"
# Description: Fills the result hash by the result of the given database query and returns the number 
#              of rows as well the error message if any occurs. 
######################################################################################################
sub LibOracle_GetByFilter_v2 {
    my ($mydbh, $table, $filter, $result_ref, $columns, $countOnly) = @_;
    my $rowcount = undef;
    $countOnly //= '';
    my $message = "";
    my $sth;
	my $trace = '  LibOracle_GetByFilter_v2';
	$Log->Message('DEBUG', $trace . " started...") ;

    if ($mydbh) {
        #execute SQL
        my %rec = ();
        my $queryStartTime = [ Time::HiRes::gettimeofday( ) ];

        if ($countOnly eq 'CountOnly' ) {
            $sth = $mydbh->prepare("select count(*) from ".$table." where ".$filter,{PrintError => 0, RaiseError => 0}); 
            if (!$sth) {
                $message = "SQL-ERR001 in prepare: return code: " . $mydbh->errstr;
                $Log->Message('ERROR', $trace . " " . $message);
            } else {
                if ($sth->execute()) {
                    #$sth->bind_columns( map {\$rec{$_}} @columns );
                    ($rowcount) = $sth->fetchrow_array();
                } else {
                    $message = "SQL-ERR002 in execute: error msg: " . $sth->errstr;
                    $Log->Message('ERROR', $trace . " " . $message);
                }       
                $sth->finish;
            }       
        } else {
            $sth = $mydbh->prepare("select ".join(',',@$columns)." from ".$table." where ".$filter,{PrintError => 0, RaiseError => 0});
            # if ($table=~/timouttest/ ) {
            #       $sth = $mydbh->prepare("select count(*) from (SELECT A.*, B.* FROM OBJ_OSIRIS_SITEDATA_V2 A CROSS JOIN OBJ_OSIRIS_SITEDATA_V2 B)",{PrintError => 0, RaiseError => 0});
            #}

            if (!$sth) {
                $message = "SQL-ERR003 in prepare: return code: " . $mydbh->errstr;
                $Log->Message('ERROR', $trace . " " . $message);
            } else {
                if ($sth->execute()) {
                #fetch lines
                while (my $row = $sth->fetchrow_hashref) {
                    push @$result_ref, $row;
                    $rowcount++;
                }
                $rowcount=0 if (!defined $rowcount);
                } else {
                    $message = "SQL-ERR004 in execute: error msg: " . $sth->errstr;
                    $Log->Message('ERROR', $trace . " " . $message);
                }
                $sth->finish;
            }               
        }       
        my $elapsed_time = Time::HiRes::tv_interval($queryStartTime);
        $Log->Message('INFO', $trace . ": Querytime of table " . $table . ": " . $elapsed_time . " Received rows: " . $rowcount);
    } else {  
        $message = "DB-ERR001: Not able to connect to DB. Error: " . DBI->errstr;
        $Log->Message('ERROR', $trace . " " . $message);
    }
    
    $Log->Message('DEBUG', $trace . " ...done") ;
	return ($rowcount, $message);
}

##################################################################################################
# Description: Handles the db connection check for a single Oracle DBH
# $dsRef->{dbh} - set to undefined if connection not established
# $dsRef->{host}
# $dsRef->{port}
# $dsRef->{service_name}
# $dsRef->{user}
# $dsRef->{passwd} - unencrypted
##################################################################################################

# Makes a single %DATASOURCE ($dsRef) connection for a single connection ($dsName) 
# with the credentials provided and sets the 'dbh' value.
sub LibOracle_GetDBH_v2 {
        my $dsRef = shift ;

        my $trace = '  LibOracle_GetDBH_v2';
        
        $Log->Message('DEBUG', $trace . " started...") ;
		$Log->Message('DEBUG', $trace . " dsRef: " . Dumper($dsRef));
		
		unless (defined ($dsRef->{dbh})) {
			$Log->Message('DEBUG', "$trace CONNECTING to Oracle") ;
			$dsRef->{dbh} = DBI->connect("DBI:Oracle:host=".$dsRef->{host}.";service_name=".$dsRef->{service_name}.";port=".$dsRef->{port}, 
										$dsRef->{user}, 
										$dsRef->{passwd}, {PrintError => 0,RaiseError => 0});
		}

		if ((defined($dsRef->{dbh})) && (!($dsRef->{dbh})->ping)) {
			$Log->Message('WARN', "$trace Connection to Oracle down, attempting to RECONNECT.") ;
            $dsRef->{dbh}->disconnect;
            undef $dsRef->{dbh} ;
			$dsRef->{dbh} = DBI->connect("DBI:Oracle:host=".$dsRef->{host}.";service_name=".$dsRef->{service_name}.";port=".$dsRef->{port}, 
										$dsRef->{user}, 
										$dsRef->{passwd}, {PrintError => 0,RaiseError => 0});
        }
        $Log->Message('DEBUG', $trace . " ...done") ;
}

# CLoses all open connections in %DATASOURCE
sub LibOracle_CloseConnections {
        my $dsRef = shift ;

		my $trace = 'LibOracle_CloseConnections';
        foreach my $dsName (keys %{$dsRef}) {
                if (defined($dsRef->{$dsName}{dbh})) {
                        $Log->Message('DEBUG', $trace . " Close DB Connection to " . $dsName . "...") ;
						$dsRef->{$dsName}{dbh}->disconnect;
                        undef $dsRef->{$dsName}{dbh} ;
                }
        }
}

1;